import { UploadResult } from '../types';

/**
 * 图床上传器接口
 */
export interface ImageUploader {
  readonly name: string;
  upload(filePath: string): Promise<UploadResult>;
  isConfigured(): boolean;
}

/**
 * 上传器工厂
 */
export class UploaderFactory {
  private uploaders = new Map<string, () => ImageUploader>();

  constructor() {
    // 注册内置上传器
    this.register('smms', () => new (require('./smms.uploader').SMSUploader)());
    this.register('github', () => new (require('./github.uploader').GitHubUploader)());
    this.register('cos', () => new (require('./cos.uploader').COSUploader)());
    this.register('oss', () => new (require('./oss.uploader').OSSUploader)());
  }

  /**
   * 注册上传器
   */
  register(name: string, factory: () => ImageUploader): void {
    this.uploaders.set(name, factory);
  }

  /**
   * 创建上传器实例
   */
  create(name: string): ImageUploader | null {
    const factory = this.uploaders.get(name);
    if (!factory) {
      return null;
    }
    
    try {
      return factory();
    } catch (error) {
      console.error(`MarkdownImageAIWorkflow: 创建上传器 ${name} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取所有支持的上传器名称
   */
  getSupportedUploaders(): string[] {
    return Array.from(this.uploaders.keys());
  }
}