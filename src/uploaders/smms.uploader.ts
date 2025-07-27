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
      console.log('MarkdownImageAIWorkflow: SM.MS Token配置:', token ? '已配置' : '未配置');

      const headers: Record<string, string> = {
        'User-Agent': 'VSCode-MarkdownImageAIWorkflow/1.0',
        ...formData.getHeaders()
      };

      if (!token) {
        return {
          success: false,
          error: 'SM.MS已停止匿名上传服务，请配置API Token',
          provider: this.name
        };
      }
      
      headers['Authorization'] = `Bearer ${token}`;
      console.log('MarkdownImageAIWorkflow: 使用API Token上传');

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
      console.log('MarkdownImageAIWorkflow: SM.MS响应数据:', JSON.stringify(responseData, null, 2));

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
          errorMsg = 'API Token无效或已过期，请检查配置';
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
      console.error('MarkdownImageAIWorkflow: SM.MS上传失败:', error);
      
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
   * 检查是否已配置
   */
  isConfigured(): boolean {
    // SM.MS已停止匿名上传，必须配置API Token
    const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
    const token = config.get<string>('token');
    return !!token;
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
        ? '已配置API Token，可以正常使用' 
        : '⚠️ 未配置API Token，SM.MS已停止匿名上传服务'
    };
  }
}