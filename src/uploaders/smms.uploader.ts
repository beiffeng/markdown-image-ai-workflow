import * as vscode from 'vscode';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as FormData from 'form-data';
import { ImageUploader } from './uploader.interface';
import { UploadResult } from '../types';

/**
 * SM.MS图床上传器
 * 官方文档: https://doc.sm.ms/
 */
export class SMSUploader implements ImageUploader {
  readonly name = 'SM.MS';
  private readonly API_URL = 'https://sm.ms/api/v2/upload';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * 上传图片到SM.MS
   */
  async upload(filePath: string): Promise<UploadResult> {
    try {
      // 检查文件大小
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过限制（${this.MAX_FILE_SIZE / 1024 / 1024}MB）`,
          provider: this.name
        };
      }

      // 读取文件
      const fileBuffer = await fs.promises.readFile(filePath);
      const fileName = filePath.split('/').pop() || 'image';

      // 准备FormData
      const formData = new FormData();
      formData.append('smfile', fileBuffer, {
        filename: fileName,
        contentType: 'image/' + fileName.split('.').pop()?.toLowerCase()
      });

      // 获取API Token（可选）
      const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
      const token = config.get<string>('token');
      console.log('MarkdownImageFlow: SM.MS Token配置:', token ? '已配置' : '未配置');

      const headers: Record<string, string> = {
        'User-Agent': 'VSCode-MarkdownImageFlow/1.0',
        ...formData.getHeaders()
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('MarkdownImageFlow: 使用API Token上传');
      } else {
        console.log('MarkdownImageFlow: 使用匿名上传');
      }

      // 使用fetch发送请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json() as any;
      console.log('MarkdownImageFlow: SM.MS响应数据:', JSON.stringify(responseData, null, 2));

      // 处理响应
      if (responseData.success) {
        return {
          success: true,
          url: responseData.data.url,
          provider: this.name
        };
      } else {
        // SM.MS返回了错误信息
        let errorMsg = responseData.message || '上传失败';
        
        // 处理常见错误信息
        if (responseData.code === 'image_repeated') {
          // 图片重复，返回已存在的URL
          if (responseData.images) {
            return {
              success: true,
              url: responseData.images,
              provider: this.name
            };
          }
          errorMsg = '图片已存在';
        } else if (responseData.code === 'unauthorized') {
          // Token失效时，尝试匿名上传
          if (token) {
            console.log('MarkdownImageFlow: API Token失效，尝试匿名上传...');
            return await this.uploadAnonymously(filePath);
          }
          errorMsg = 'API Token无效或已过期';
        } else if (responseData.code === 'flood') {
          errorMsg = '上传过于频繁，请稍后再试';
        }

        return {
          success: false,
          error: errorMsg,
          provider: this.name
        };
      }
    } catch (error) {
      console.error('MarkdownImageFlow: SM.MS上传失败:', error);
      
      let errorMsg = '上传失败';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = '上传超时，请检查网络连接';
        } else if (error.message.includes('413')) {
          errorMsg = '文件过大';
        } else if (error.message.includes('5')) {
          errorMsg = 'SM.MS服务器错误，请稍后再试';
        } else {
          errorMsg = error.message;
        }
      }

      return {
        success: false,
        error: errorMsg,
        provider: this.name
      };
    }
  }

  /**
   * 匿名上传（当Token失效时的fallback）
   */
  private async uploadAnonymously(filePath: string): Promise<UploadResult> {
    try {
      // 读取文件
      const fileBuffer = await fs.promises.readFile(filePath);
      const fileName = filePath.split('/').pop() || 'image';

      // 准备FormData（不包含Authorization头）
      const formData = new FormData();
      formData.append('smfile', fileBuffer, {
        filename: fileName,
        contentType: 'image/' + fileName.split('.').pop()?.toLowerCase()
      });

      const headers: Record<string, string> = {
        'User-Agent': 'VSCode-MarkdownImageFlow/1.0',
        ...formData.getHeaders()
      };

      console.log('MarkdownImageFlow: 使用匿名模式上传');

      // 使用fetch发送请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json() as any;
      console.log('MarkdownImageFlow: SM.MS匿名上传响应:', JSON.stringify(responseData, null, 2));

      // 处理响应
      if (responseData.success) {
        console.log('MarkdownImageFlow: ✅ 匿名上传成功！');
        return {
          success: true,
          url: responseData.data.url,
          provider: this.name + ' (匿名)'
        };
      } else {
        return {
          success: false,
          error: responseData.message || '匿名上传失败',
          provider: this.name
        };
      }
    } catch (error) {
      console.error('MarkdownImageFlow: 匿名上传失败:', error);
      return {
        success: false,
        error: '匿名上传失败',
        provider: this.name
      };
    }
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    // SM.MS不需要必须配置Token，但配置了会有更高的限制
    return true;
  }

  /**
   * 获取配置状态信息
   */
  getConfigStatus(): {
    hasToken: boolean;
    status: string;
  } {
    const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
    const token = config.get<string>('token');
    const hasToken = !!token;

    return {
      hasToken,
      status: hasToken 
        ? '已配置API Token，享受更高上传限制' 
        : '未配置API Token，使用游客限制'
    };
  }
}