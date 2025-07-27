import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as COS from 'cos-nodejs-sdk-v5';
import { ImageUploader } from './uploader.interface';
import { UploadResult } from '../types';

/**
 * 腾讯云COS图床上传器
 * 使用腾讯云对象存储服务上传图片文件
 */
export class COSUploader implements ImageUploader {
  readonly name = '腾讯云COS';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB (COS单文件限制)
  private cosClient: any = null;

  /**
   * 上传图片到腾讯云COS
   */
  async upload(filePath: string): Promise<UploadResult> {
    try {
      const config = this.getConfig();
      if (!config.secretId || !config.secretKey || !config.bucket || !config.region) {
        return {
          success: false,
          error: '腾讯云COS配置不完整，请检查SecretId、SecretKey、Bucket和Region配置',
          provider: this.name
        };
      }

      // 检查文件大小
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过腾讯云COS限制（${this.MAX_FILE_SIZE / 1024 / 1024 / 1024}GB）`,
          provider: this.name
        };
      }

      // 初始化COS客户端
      if (!this.cosClient) {
        console.log('MarkdownImageAIWorkflow: 初始化COS客户端...');
        this.cosClient = new COS({
          SecretId: config.secretId,
          SecretKey: config.secretKey
        });
        console.log('MarkdownImageAIWorkflow: COS客户端初始化完成');
      }

      const fileName = path.basename(filePath);
      
      // 生成文件路径（按年/月组织）
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const pathPrefix = config.path || 'images/';
      const key = `${pathPrefix}${year}/${month}/${fileName}`;

      console.log('MarkdownImageAIWorkflow: 开始上传到COS:', key);

      // 检查文件是否已存在
      const existingFile = await this.checkFileExists(config.bucket, config.region, key);
      if (existingFile) {
        console.log('MarkdownImageAIWorkflow: 文件已存在，返回现有URL:', existingFile);
        return {
          success: true,
          url: existingFile,
          provider: this.name
        };
      }

      console.log('MarkdownImageAIWorkflow: 文件不存在，开始上传...');

      // 上传文件
      const uploadResult = await this.uploadFile(config.bucket, config.region, key, filePath);
      
      if (uploadResult.success) {
        // 构建CDN访问URL
        const url = `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`;
        console.log('MarkdownImageAIWorkflow: COS上传成功，生成URL:', url);
        
        // 验证文件确实已上传（可选的二次确认）
        setTimeout(async () => {
          const verifyUrl = await this.checkFileExists(config.bucket, config.region, key);
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
        console.error('MarkdownImageAIWorkflow: COS上传失败:', uploadResult.error);
        return {
          success: false,
          error: uploadResult.error,
          provider: this.name
        };
      }
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 腾讯云COS上传失败:', error);
      
      let errorMsg = '上传失败';
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMsg = '权限不足，请检查SecretId和SecretKey是否正确，以及是否有COS操作权限';
        } else if (error.message.includes('404') || error.message.includes('NoSuchBucket')) {
          errorMsg = '存储桶不存在，请检查Bucket名称和Region是否正确';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMsg = 'SecretId或SecretKey无效';
        } else if (error.message.includes('RequestTimeTooSkewed')) {
          errorMsg = '本地时间与服务器时间偏差过大，请检查系统时间';
        } else if (error.message.includes('SignatureDoesNotMatch')) {
          errorMsg = '签名不匹配，请检查SecretKey是否正确';
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
  private async checkFileExists(bucket: string, region: string, key: string): Promise<string | null> {
    try {
      console.log('MarkdownImageAIWorkflow: 检查文件是否存在:', key);
      
      const result = await new Promise((resolve, reject) => {
        this.cosClient.headObject({
          Bucket: bucket,
          Region: region,
          Key: key
        }, (err: any, data: any) => {
          if (err) {
            if (err.statusCode === 404 || err.code === 'NoSuchKey') {
              console.log('MarkdownImageAIWorkflow: 文件不存在，可以上传');
              resolve(null); // 文件不存在
            } else {
              console.error('MarkdownImageAIWorkflow: 检查文件存在性时发生错误:', err);
              reject(err);
            }
          } else {
            console.log('MarkdownImageAIWorkflow: 文件已存在:', data);
            resolve(data);
          }
        });
      });

      if (result) {
        // 文件存在，返回URL
        const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
        console.log('MarkdownImageAIWorkflow: 文件已存在，返回URL:', url);
        return url;
      } else {
        // 文件不存在
        return null;
      }
    } catch (error) {
      // 文件不存在或其他错误
      console.log('MarkdownImageAIWorkflow: checkFileExists异常，假设文件不存在:', error);
      return null;
    }
  }

  /**
   * 上传文件到COS
   */
  private async uploadFile(bucket: string, region: string, key: string, filePath: string): Promise<{
    success: boolean;
    error?: string;
    location?: string;
  }> {
    return new Promise((resolve) => {
      console.log('MarkdownImageAIWorkflow: 准备上传文件:', {
        bucket,
        region,
        key,
        filePath: path.basename(filePath)
      });

      this.cosClient.uploadFile({
        Bucket: bucket,
        Region: region,
        Key: key,
        FilePath: filePath,
        SliceSize: 1024 * 1024 * 5, // 5MB分片上传阈值
        onProgress: (progressData: any) => {
          console.log('MarkdownImageAIWorkflow: COS上传进度:', Math.round(progressData.percent * 100) + '%');
        }
      }, (err: any, data: any) => {
        if (err) {
          console.error('MarkdownImageAIWorkflow: COS上传错误详情:', {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
            headers: err.headers
          });
          
          let errorMessage = err.message || '上传失败';
          
          // 根据错误代码提供更具体的错误信息
          if (err.code === 'NoSuchBucket') {
            errorMessage = `存储桶 ${bucket} 不存在，请检查Bucket名称和Region配置`;
          } else if (err.code === 'AccessDenied') {
            errorMessage = '访问被拒绝，请检查SecretId、SecretKey权限';
          } else if (err.code === 'SignatureDoesNotMatch') {
            errorMessage = '签名不匹配，请检查SecretKey是否正确';
          } else if (err.statusCode === 403) {
            errorMessage = '权限不足，请确认API密钥有COS写入权限';
          }
          
          resolve({
            success: false,
            error: errorMessage
          });
        } else {
          console.log('MarkdownImageAIWorkflow: COS上传成功详情:', {
            location: data.Location,
            etag: data.ETag,
            versionId: data.VersionId
          });
          
          resolve({
            success: true,
            location: data.Location
          });
        }
      });
    });
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.secretId && config.secretKey && config.bucket && config.region);
  }

  /**
   * 获取配置
   */
  private getConfig() {
    const config = vscode.workspace.getConfiguration('markdownImageFlow.cos');
    return {
      secretId: config.get<string>('secretId', ''),
      secretKey: config.get<string>('secretKey', ''),
      bucket: config.get<string>('bucket', ''),
      region: config.get<string>('region', 'ap-guangzhou'),
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
    
    if (!config.secretId) {
      return { valid: false, error: 'SecretId未配置' };
    }

    if (!config.secretKey) {
      return { valid: false, error: 'SecretKey未配置' };
    }

    if (!config.bucket) {
      return { valid: false, error: 'Bucket名称未配置' };
    }

    if (!config.region) {
      return { valid: false, error: 'Region未配置' };
    }

    // 验证Bucket格式
    if (!/^[a-zA-Z0-9.-]+-\d+$/.test(config.bucket)) {
      return { valid: false, error: 'Bucket名称格式错误，应为 bucketname-appid 格式' };
    }

    try {
      // 初始化COS客户端
      const testClient = new COS({
        SecretId: config.secretId,
        SecretKey: config.secretKey
      });

      // 测试访问权限 - 获取存储桶信息
      await new Promise((resolve, reject) => {
        testClient.headBucket({
          Bucket: config.bucket,
          Region: config.region
        }, (err: any, data: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      return { valid: true };
    } catch (error: any) {
      let errorMsg = '配置验证失败';
      if (error.statusCode === 403) {
        errorMsg = 'SecretId或SecretKey权限不足';
      } else if (error.statusCode === 404) {
        errorMsg = '存储桶不存在或Region配置错误';
      } else if (error.statusCode === 401) {
        errorMsg = 'SecretId或SecretKey无效';
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
    region?: string;
    status: string;
  } {
    const config = this.getConfig();
    const configured = this.isConfigured();

    return {
      configured,
      bucket: config.bucket,
      region: config.region,
      status: configured 
        ? `已配置存储桶: ${config.bucket} (${config.region}地域)` 
        : '未配置腾讯云COS信息'
    };
  }

  /**
   * 获取常用地域列表
   */
  static getCommonRegions(): Array<{ value: string; label: string }> {
    return [
      { value: 'ap-guangzhou', label: '广州 (ap-guangzhou)' },
      { value: 'ap-shanghai', label: '上海 (ap-shanghai)' },
      { value: 'ap-beijing', label: '北京 (ap-beijing)' },
      { value: 'ap-chengdu', label: '成都 (ap-chengdu)' },
      { value: 'ap-chongqing', label: '重庆 (ap-chongqing)' },
      { value: 'ap-shenzhen-fsi', label: '深圳金融 (ap-shenzhen-fsi)' },
      { value: 'ap-shanghai-fsi', label: '上海金融 (ap-shanghai-fsi)' },
      { value: 'ap-beijing-fsi', label: '北京金融 (ap-beijing-fsi)' },
      { value: 'ap-hongkong', label: '香港 (ap-hongkong)' },
      { value: 'ap-singapore', label: '新加坡 (ap-singapore)' },
      { value: 'ap-mumbai', label: '孟买 (ap-mumbai)' },
      { value: 'ap-jakarta', label: '雅加达 (ap-jakarta)' },
      { value: 'ap-seoul', label: '首尔 (ap-seoul)' },
      { value: 'ap-bangkok', label: '曼谷 (ap-bangkok)' },
      { value: 'ap-tokyo', label: '东京 (ap-tokyo)' },
      { value: 'na-siliconvalley', label: '硅谷 (na-siliconvalley)' },
      { value: 'na-ashburn', label: '弗吉尼亚 (na-ashburn)' },
      { value: 'na-toronto', label: '多伦多 (na-toronto)' },
      { value: 'eu-frankfurt', label: '法兰克福 (eu-frankfurt)' },
      { value: 'eu-moscow', label: '莫斯科 (eu-moscow)' }
    ];
  }
}