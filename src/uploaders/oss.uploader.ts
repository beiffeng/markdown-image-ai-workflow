import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as OSS from 'ali-oss';
import { ImageUploader } from './uploader.interface';
import { UploadResult } from '../types';

/**
 * 阿里云OSS图床上传器
 * 使用阿里云对象存储服务上传图片文件
 */
export class OSSUploader implements ImageUploader {
  readonly name = '阿里云OSS';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB (OSS单文件限制)
  private ossClient: OSS | null = null;

  /**
   * 上传图片到阿里云OSS
   */
  async upload(filePath: string): Promise<UploadResult> {
    try {
      const config = this.getConfig();
      if (!config.accessKeyId || !config.accessKeySecret || !config.bucket || !config.region) {
        return {
          success: false,
          error: '阿里云OSS配置不完整，请检查AccessKeyId、AccessKeySecret、Bucket和Region配置',
          provider: this.name
        };
      }

      // 检查文件大小
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过阿里云OSS限制（${this.MAX_FILE_SIZE / 1024 / 1024 / 1024}GB）`,
          provider: this.name
        };
      }

      // 初始化OSS客户端
      if (!this.ossClient) {
        console.log('MarkdownImageAIWorkflow: 初始化OSS客户端...');
        this.ossClient = new OSS({
          accessKeyId: config.accessKeyId,
          accessKeySecret: config.accessKeySecret,
          bucket: config.bucket,
          region: config.region
        });
        console.log('MarkdownImageAIWorkflow: OSS客户端初始化完成');
      }

      const fileName = path.basename(filePath);
      
      // 生成文件路径（按年/月组织）
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const pathPrefix = config.path || 'images/';
      const objectName = `${pathPrefix}${year}/${month}/${fileName}`;

      console.log('MarkdownImageAIWorkflow: 开始上传到OSS:', objectName);

      // 检查文件是否已存在
      const existingUrl = await this.checkFileExists(objectName);
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
      const uploadResult = await this.uploadFile(objectName, filePath);
      
      if (uploadResult.success) {
        // 构建CDN访问URL
        const url = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectName}`;
        console.log('MarkdownImageAIWorkflow: OSS上传成功，生成URL:', url);
        
        // 验证文件确实已上传（可选的二次确认）
        setTimeout(async () => {
          const verifyUrl = await this.checkFileExists(objectName);
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
        console.error('MarkdownImageAIWorkflow: OSS上传失败:', uploadResult.error);
        return {
          success: false,
          error: uploadResult.error,
          provider: this.name
        };
      }
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 阿里云OSS上传失败:', error);
      
      let errorMsg = '上传失败';
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMsg = '权限不足，请检查AccessKeyId和AccessKeySecret是否正确，以及是否有OSS操作权限';
        } else if (error.message.includes('404') || error.message.includes('NoSuchBucket')) {
          errorMsg = '存储桶不存在，请检查Bucket名称和Region是否正确';
        } else if (error.message.includes('InvalidAccessKeyId')) {
          errorMsg = 'AccessKeyId无效，请检查配置';
        } else if (error.message.includes('SignatureDoesNotMatch')) {
          errorMsg = '签名不匹配，请检查AccessKeySecret是否正确';
        } else if (error.message.includes('RequestTimeTooSkewed')) {
          errorMsg = '本地时间与服务器时间偏差过大，请检查系统时间';
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
  private async checkFileExists(objectName: string): Promise<string | null> {
    try {
      console.log('MarkdownImageAIWorkflow: 检查文件是否存在:', objectName);
      
      const result = await this.ossClient!.head(objectName);
      
      if (result.res && result.res.status === 200) {
        // 文件存在，返回URL
        const config = this.getConfig();
        const url = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectName}`;
        console.log('MarkdownImageAIWorkflow: 文件已存在，返回URL:', url);
        return url;
      } else {
        // 文件不存在
        return null;
      }
    } catch (error: any) {
      // 文件不存在或其他错误
      if (error.code === 'NoSuchKey' || error.status === 404) {
        console.log('MarkdownImageAIWorkflow: 文件不存在，可以上传');
        return null;
      } else {
        console.log('MarkdownImageAIWorkflow: checkFileExists异常，假设文件不存在:', error);
        return null;
      }
    }
  }

  /**
   * 上传文件到OSS
   */
  private async uploadFile(objectName: string, filePath: string): Promise<{
    success: boolean;
    error?: string;
    url?: string;
  }> {
    try {
      console.log('MarkdownImageAIWorkflow: 准备上传文件:', {
        objectName,
        filePath: path.basename(filePath)
      });

      // 使用put方法上传文件
      const result = await this.ossClient!.put(objectName, filePath);

      if (result.res && result.res.status === 200) {
        console.log('MarkdownImageAIWorkflow: OSS上传成功详情:', {
          url: result.url,
          name: result.name,
          etag: (result.res as any).headers?.etag || 'unknown'
        });
        
        return {
          success: true,
          url: result.url
        };
      } else {
        const errorMsg = `上传失败，状态码: ${result.res?.status}`;
        console.error('MarkdownImageAIWorkflow: OSS上传失败:', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }
    } catch (error: any) {
      console.error('MarkdownImageAIWorkflow: OSS上传错误详情:', {
        code: error.code,
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      let errorMessage = error.message || '上传失败';
      
      // 根据错误代码提供更具体的错误信息
      if (error.code === 'NoSuchBucket') {
        errorMessage = `存储桶不存在，请检查Bucket名称和Region配置`;
      } else if (error.code === 'AccessDenied') {
        errorMessage = '访问被拒绝，请检查AccessKeyId、AccessKeySecret权限';
      } else if (error.code === 'SignatureDoesNotMatch') {
        errorMessage = '签名不匹配，请检查AccessKeySecret是否正确';
      } else if (error.status === 403) {
        errorMessage = '权限不足，请确认API密钥有OSS写入权限';
      } else if (error.code === 'InvalidAccessKeyId') {
        errorMessage = 'AccessKeyId无效，请检查配置';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.accessKeyId && config.accessKeySecret && config.bucket && config.region);
  }

  /**
   * 获取配置
   */
  private getConfig() {
    const config = vscode.workspace.getConfiguration('markdownImageAIWorkflow.oss');
    return {
      accessKeyId: config.get<string>('accessKeyId', ''),
      accessKeySecret: config.get<string>('accessKeySecret', ''),
      bucket: config.get<string>('bucket', ''),
      region: config.get<string>('region', 'oss-cn-hangzhou'),
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
    
    if (!config.accessKeyId) {
      return { valid: false, error: 'AccessKeyId未配置' };
    }

    if (!config.accessKeySecret) {
      return { valid: false, error: 'AccessKeySecret未配置' };
    }

    if (!config.bucket) {
      return { valid: false, error: 'Bucket名称未配置' };
    }

    if (!config.region) {
      return { valid: false, error: 'Region未配置' };
    }

    try {
      // 初始化OSS客户端
      const testClient = new OSS({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
        region: config.region
      });

      // 测试访问权限 - 获取存储桶信息
      await testClient.getBucketInfo(config.bucket);

      return { valid: true };
    } catch (error: any) {
      let errorMsg = '配置验证失败';
      if (error.status === 403) {
        errorMsg = 'AccessKeyId或AccessKeySecret权限不足';
      } else if (error.status === 404 || error.code === 'NoSuchBucket') {
        errorMsg = '存储桶不存在或Region配置错误';
      } else if (error.code === 'InvalidAccessKeyId') {
        errorMsg = 'AccessKeyId无效';
      } else if (error.code === 'SignatureDoesNotMatch') {
        errorMsg = 'AccessKeySecret无效';
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
        : '未配置阿里云OSS信息'
    };
  }

  /**
   * 获取常用地域列表
   */
  static getCommonRegions(): Array<{ value: string; label: string }> {
    return [
      { value: 'oss-cn-hangzhou', label: '杭州 (oss-cn-hangzhou)' },
      { value: 'oss-cn-shanghai', label: '上海 (oss-cn-shanghai)' },
      { value: 'oss-cn-beijing', label: '北京 (oss-cn-beijing)' },
      { value: 'oss-cn-shenzhen', label: '深圳 (oss-cn-shenzhen)' },
      { value: 'oss-cn-guangzhou', label: '广州 (oss-cn-guangzhou)' },
      { value: 'oss-cn-chengdu', label: '成都 (oss-cn-chengdu)' },
      { value: 'oss-cn-qingdao', label: '青岛 (oss-cn-qingdao)' },
      { value: 'oss-cn-zhangjiakou', label: '张家口 (oss-cn-zhangjiakou)' },
      { value: 'oss-cn-huhehaote', label: '呼和浩特 (oss-cn-huhehaote)' },
      { value: 'oss-cn-wulanchabu', label: '乌兰察布 (oss-cn-wulanchabu)' },
      { value: 'oss-cn-hongkong', label: '香港 (oss-cn-hongkong)' },
      { value: 'oss-ap-southeast-1', label: '新加坡 (oss-ap-southeast-1)' },
      { value: 'oss-ap-southeast-2', label: '悉尼 (oss-ap-southeast-2)' },
      { value: 'oss-ap-southeast-3', label: '吉隆坡 (oss-ap-southeast-3)' },
      { value: 'oss-ap-southeast-5', label: '雅加达 (oss-ap-southeast-5)' },
      { value: 'oss-ap-northeast-1', label: '东京 (oss-ap-northeast-1)' },
      { value: 'oss-ap-south-1', label: '孟买 (oss-ap-south-1)' },
      { value: 'oss-us-west-1', label: '硅谷 (oss-us-west-1)' },
      { value: 'oss-us-east-1', label: '弗吉尼亚 (oss-us-east-1)' },
      { value: 'oss-eu-central-1', label: '法兰克福 (oss-eu-central-1)' },
      { value: 'oss-eu-west-1', label: '伦敦 (oss-eu-west-1)' },
      { value: 'oss-me-east-1', label: '迪拜 (oss-me-east-1)' }
    ];
  }
}