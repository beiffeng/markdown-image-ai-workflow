import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as qiniu from 'qiniu';
import { ImageUploader } from './uploader.interface';
import { UploadResult } from '../types';

/**
 * 七牛云存储图床上传器
 * 使用七牛云对象存储服务上传图片文件
 */
export class QiniuUploader implements ImageUploader {
  readonly name = '七牛云存储';
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (七牛云单文件限制)

  /**
   * 上传图片到七牛云存储
   */
  async upload(filePath: string): Promise<UploadResult> {
    try {
      const config = this.getConfig();
      if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
        return {
          success: false,
          error: '七牛云存储配置不完整，请检查AccessKey、SecretKey、Bucket和Domain配置',
          provider: this.name
        };
      }

      // 检查文件大小
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过七牛云存储限制（${this.MAX_FILE_SIZE / 1024 / 1024}MB）`,
          provider: this.name
        };
      }

      console.log('MarkdownImageAIWorkflow: 初始化七牛云客户端...');

      const fileName = path.basename(filePath);
      
      // 生成文件路径（按年/月组织）
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const pathPrefix = config.path || 'images/';
      const key = `${pathPrefix}${year}/${month}/${fileName}`;

      console.log('MarkdownImageAIWorkflow: 开始上传到七牛云:', key);

      // 检查文件是否已存在
      const existingUrl = await this.checkFileExists(key, config);
      if (existingUrl) {
        console.log('MarkdownImageAIWorkflow: 文件已存在，返回现有URL:', existingUrl);
        return {
          success: true,
          url: existingUrl,
          provider: this.name
        };
      }

      console.log('MarkdownImageAIWorkflow: 文件不存在，开始上传...');

      // 上传文件
      const uploadResult = await this.uploadFile(key, filePath, config);
      
      if (uploadResult.success) {
        // 构建CDN访问URL
        const url = `https://${config.domain}/${key}`;
        console.log('MarkdownImageAIWorkflow: 七牛云上传成功，生成URL:', url);
        
        // 验证文件确实已上传（可选的二次确认）
        setTimeout(async () => {
          const verifyUrl = await this.checkFileExists(key, config);
          if (verifyUrl) {
            console.log('MarkdownImageAIWorkflow: 文件上传验证成功');
          } else {
            console.warn('MarkdownImageAIWorkflow: 警告：文件上传后验证失败');
          }
        }, 2000);
        
        return {
          success: true,
          url: url,
          provider: this.name
        };
      } else {
        console.error('MarkdownImageAIWorkflow: 七牛云上传失败:', uploadResult.error);
        return {
          success: false,
          error: uploadResult.error,
          provider: this.name
        };
      }
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 七牛云存储上传失败:', error);
      
      let errorMsg = '上传失败';
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMsg = '权限不足，请检查AccessKey和SecretKey是否正确，以及是否有存储空间操作权限';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMsg = 'AccessKey或SecretKey无效，请检查配置';
        } else if (error.message.includes('no such bucket') || error.message.includes('bucket not exist')) {
          errorMsg = '存储空间不存在，请检查Bucket名称是否正确';
        } else if (error.message.includes('invalid domain')) {
          errorMsg = '域名配置错误，请检查Domain配置';
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
   * 检查文件是否已存在
   */
  private async checkFileExists(key: string, config: any): Promise<string | null> {
    try {
      console.log('MarkdownImageAIWorkflow: 检查文件是否存在:', key);
      
      // 创建认证对象
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
      
      // 创建配置对象
      const qiniuConfig = new qiniu.conf.Config();
      // 设置存储区域
      qiniuConfig.zone = this.getZoneConfig(config.zone);
      
      // 创建文件管理器
      const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);
      
      // 检查文件是否存在
      const result = await new Promise<any>((resolve, reject) => {
        bucketManager.stat(config.bucket, key, (err: any, respBody: any, respInfo: any) => {
          if (err) {
            reject(err);
          } else {
            if (respInfo.statusCode === 200) {
              resolve(respBody);
            } else if (respInfo.statusCode === 612) {
              // 文件不存在
              resolve(null);
            } else {
              reject(new Error(`检查文件存在性失败: ${respInfo.statusCode}`));
            }
          }
        });
      });

      if (result) {
        // 文件存在，返回URL
        const url = `https://${config.domain}/${key}`;
        console.log('MarkdownImageAIWorkflow: 文件已存在，返回URL:', url);
        return url;
      } else {
        // 文件不存在
        console.log('MarkdownImageAIWorkflow: 文件不存在，可以上传');
        return null;
      }
    } catch (error: any) {
      // 文件不存在或其他错误
      console.log('MarkdownImageAIWorkflow: checkFileExists异常，假设文件不存在:', error);
      return null;
    }
  }

  /**
   * 上传文件到七牛云
   */
  private async uploadFile(key: string, filePath: string, config: any): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('MarkdownImageAIWorkflow: 准备上传文件:', {
        key,
        filePath: path.basename(filePath)
      });

      // 创建认证对象
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
      
      // 创建上传策略
      const options = {
        scope: config.bucket,
        expires: 7200 // 2小时有效期
      };
      const putPolicy = new qiniu.rs.PutPolicy(options);
      const uploadToken = putPolicy.uploadToken(mac);

      // 创建配置对象
      const qiniuConfig = new qiniu.conf.Config();
      // 设置存储区域
      qiniuConfig.zone = this.getZoneConfig(config.zone);
      
      // 创建表单上传器
      const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
      const putExtra = new qiniu.form_up.PutExtra();

      // 执行上传
      await new Promise<any>((resolve, reject) => {
        formUploader.putFile(uploadToken, key, filePath, putExtra, (err: any, respBody: any, respInfo: any) => {
          if (err) {
            reject(err);
          } else {
            if (respInfo.statusCode === 200) {
              console.log('MarkdownImageAIWorkflow: 七牛云上传成功详情:', {
                key: respBody.key,
                hash: respBody.hash,
                statusCode: respInfo.statusCode
              });
              resolve(respBody);
            } else {
              reject(new Error(`上传失败，状态码: ${respInfo.statusCode}, 响应: ${JSON.stringify(respBody)}`));
            }
          }
        });
      });

      return {
        success: true
      };
    } catch (error: any) {
      console.error('MarkdownImageAIWorkflow: 七牛云上传错误详情:', {
        message: error.message,
        code: error.code
      });
      
      let errorMessage = error.message || '上传失败';
      
      // 根据错误信息提供更具体的错误信息
      if (error.message.includes('invalid token')) {
        errorMessage = '上传令牌无效，请检查AccessKey和SecretKey配置';
      } else if (error.message.includes('bucket not exist')) {
        errorMessage = '存储空间不存在，请检查Bucket配置';
      } else if (error.message.includes('403')) {
        errorMessage = '权限不足，请确认AccessKey有存储空间写入权限';
      } else if (error.message.includes('401')) {
        errorMessage = 'AccessKey或SecretKey无效';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 获取存储区域配置
   */
  private getZoneConfig(zone: string): any {
    switch (zone) {
      case 'z0':
        return qiniu.zone.Zone_z0; // 华东
      case 'z1':
        return qiniu.zone.Zone_z1; // 华北
      case 'z2':
        return qiniu.zone.Zone_z2; // 华南
      case 'na0':
        return qiniu.zone.Zone_na0; // 北美
      case 'as0':
        return qiniu.zone.Zone_as0; // 东南亚
      default:
        return qiniu.zone.Zone_z0; // 默认华东
    }
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.accessKey && config.secretKey && config.bucket && config.domain);
  }

  /**
   * 获取配置
   */
  private getConfig() {
    const config = vscode.workspace.getConfiguration('markdownImageAIWorkflow.qiniu');
    return {
      accessKey: config.get<string>('accessKey', ''),
      secretKey: config.get<string>('secretKey', ''),
      bucket: config.get<string>('bucket', ''),
      domain: config.get<string>('domain', ''),
      zone: config.get<string>('zone', 'z0'),
      path: config.get<string>('path', 'images/')
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<{
    valid: boolean;
    error?: string;
  }> {
    const config = this.getConfig();
    
    if (!config.accessKey) {
      return { valid: false, error: 'AccessKey未配置' };
    }

    if (!config.secretKey) {
      return { valid: false, error: 'SecretKey未配置' };
    }

    if (!config.bucket) {
      return { valid: false, error: 'Bucket名称未配置' };
    }

    if (!config.domain) {
      return { valid: false, error: 'Domain域名未配置' };
    }

    try {
      // 创建认证对象
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
      
      // 创建配置对象
      const qiniuConfig = new qiniu.conf.Config();
      qiniuConfig.zone = this.getZoneConfig(config.zone);
      
      // 创建文件管理器
      const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);
      
      // 测试访问权限 - 获取存储空间信息
      await new Promise<void>((resolve, reject) => {
        bucketManager.getBucketInfo(config.bucket, (err: any, _respBody: any, respInfo: any) => {
          if (err) {
            reject(err);
          } else {
            if (respInfo.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`获取存储空间信息失败: ${respInfo.statusCode}`));
            }
          }
        });
      });

      return { valid: true };
    } catch (error: any) {
      let errorMsg = '配置验证失败';
      if (error.message.includes('401')) {
        errorMsg = 'AccessKey或SecretKey无效';
      } else if (error.message.includes('403')) {
        errorMsg = 'AccessKey权限不足';
      } else if (error.message.includes('bucket not exist')) {
        errorMsg = '存储空间不存在或名称错误';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      return { valid: false, error: errorMsg };
    }
  }

  /**
   * 获取配置状态信息
   */
  getConfigStatus(): {
    configured: boolean;
    bucket?: string;
    domain?: string;
    status: string;
  } {
    const config = this.getConfig();
    const configured = this.isConfigured();

    return {
      configured,
      bucket: config.bucket,
      domain: config.domain,
      status: configured 
        ? `已配置存储空间: ${config.bucket} (域名: ${config.domain})` 
        : '未配置七牛云存储信息'
    };
  }

  /**
   * 获取常用存储区域列表
   */
  static getCommonZones(): Array<{ value: string; label: string }> {
    return [
      { value: 'z0', label: '华东 (z0) - 默认' },
      { value: 'z1', label: '华北 (z1)' },
      { value: 'z2', label: '华南 (z2)' },
      { value: 'na0', label: '北美 (na0)' },
      { value: 'as0', label: '东南亚 (as0)' }
    ];
  }
}