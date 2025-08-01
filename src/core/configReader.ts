import * as vscode from 'vscode';
import { VSCodeMarkdownConfig, MarkdownImageAIWorkflowConfig } from '../types';

/**
 * VSCode配置读取器 - 专门处理VSCode原生配置
 */
export class VSCodeConfigReader {
  /**
   * 获取VSCode原生的markdown.copyFiles.destination配置
   */
  getCopyFilesDestination(): Record<string, string> | undefined {
    const config = vscode.workspace.getConfiguration('markdown.copyFiles');
    return config.get<Record<string, string>>('destination');
  }

  /**
   * 检查是否启用了图片粘贴功能
   */
  isImagePasteEnabled(): boolean {
    const dropConfig = vscode.workspace.getConfiguration('markdown.editor.drop');
    const pasteConfig = vscode.workspace.getConfiguration('markdown.editor.filePaste');
    
    const dropEnabled = dropConfig.get<string>('copyIntoWorkspace', 'mediaFiles') !== 'never';
    const pasteEnabled = pasteConfig.get<string>('copyIntoWorkspace', 'mediaFiles') !== 'never';
    
    return dropEnabled || pasteEnabled;
  }

  /**
   * 获取文件覆盖行为配置
   */
  getOverwriteBehavior(): 'nameIncrementally' | 'overwrite' {
    const config = vscode.workspace.getConfiguration('markdown.copyFiles');
    return config.get<'nameIncrementally' | 'overwrite'>('overwriteBehavior', 'nameIncrementally');
  }

  /**
   * 获取完整的VSCode Markdown配置
   */
  getVSCodeMarkdownConfig(): VSCodeMarkdownConfig {
    return {
      'markdown.copyFiles.destination': this.getCopyFilesDestination(),
      'markdown.copyFiles.overwriteBehavior': this.getOverwriteBehavior(),
      'markdown.editor.drop.copyIntoWorkspace': vscode.workspace.getConfiguration('markdown.editor.drop').get('copyIntoWorkspace'),
      'markdown.editor.filePaste.copyIntoWorkspace': vscode.workspace.getConfiguration('markdown.editor.filePaste').get('copyIntoWorkspace')
    };
  }

  /**
   * 检查VSCode是否正确配置了图片处理功能
   */
  isVSCodeProperlyConfigured(): {
    configured: boolean;
    hasDestination: boolean;
    pasteEnabled: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const hasDestination = !!this.getCopyFilesDestination();
    const pasteEnabled = this.isImagePasteEnabled();

    if (!pasteEnabled) {
      issues.push('图片粘贴功能被禁用，请检查 markdown.editor.drop.copyIntoWorkspace 和 markdown.editor.filePaste.copyIntoWorkspace 配置');
    }

    if (!hasDestination) {
      issues.push('未配置 markdown.copyFiles.destination，将使用默认行为（保存在markdown文件同级目录）');
    }

    return {
      configured: pasteEnabled && issues.length === 0,
      hasDestination,
      pasteEnabled,
      issues
    };
  }
}

/**
 * 插件配置读取器
 */
export class PluginConfigReader {
  /**
   * 获取插件配置
   */
  getConfig(): MarkdownImageAIWorkflowConfig {
    const config = vscode.workspace.getConfiguration('markdownImageAIWorkflow');
    
    return {
      enabled: config.get<boolean>('enabled', true),
      provider: config.get<'smms' | 'github' | 'cloudinary' | 'cos' | 'oss' | 'qiniu'>('provider', 'github'),
      respectVSCodeConfig: config.get<boolean>('respectVSCodeConfig', true),
      fallbackBehavior: config.get<'sameDirectory' | 'disable' | 'prompt'>('fallbackBehavior', 'sameDirectory'),
      deleteLocalAfterUpload: config.get<boolean>('deleteLocalAfterUpload', false),
      smms: {
        token: config.get<string>('smms.token', '')
      },
      github: {
        repo: config.get<string>('github.repo', ''),
        token: config.get<string>('github.token', ''),
        branch: config.get<string>('github.branch', 'main')
      },
      cos: {
        secretId: config.get<string>('cos.secretId', ''),
        secretKey: config.get<string>('cos.secretKey', ''),
        bucket: config.get<string>('cos.bucket', ''),
        region: config.get<string>('cos.region', 'ap-guangzhou'),
        path: config.get<string>('cos.path', 'images/')
      },
      oss: {
        accessKeyId: config.get<string>('oss.accessKeyId', ''),
        accessKeySecret: config.get<string>('oss.accessKeySecret', ''),
        bucket: config.get<string>('oss.bucket', ''),
        region: config.get<string>('oss.region', 'oss-cn-hangzhou'),
        path: config.get<string>('oss.path', 'images/')
      },
      qiniu: {
        accessKey: config.get<string>('qiniu.accessKey', ''),
        secretKey: config.get<string>('qiniu.secretKey', ''),
        bucket: config.get<string>('qiniu.bucket', ''),
        domain: config.get<string>('qiniu.domain', ''),
        zone: config.get<string>('qiniu.zone', 'z0'),
        path: config.get<string>('qiniu.path', 'images/')
      }
    };
  }

  /**
   * 检查插件是否正确配置
   */
  isPluginProperlyConfigured(): {
    configured: boolean;
    provider: string;
    issues: string[];
  } {
    const config = this.getConfig();
    const issues: string[] = [];

    if (!config.enabled) {
      issues.push('插件功能已禁用');
      return { configured: false, provider: config.provider, issues };
    }

    switch (config.provider) {
      case 'smms':
        // SM.MS token是可选的
        break;
      case 'github':
        if (!config.github.repo) {
          issues.push('GitHub仓库名称未配置');
        }
        if (!config.github.token) {
          issues.push('GitHub Personal Access Token未配置');
        }
        break;
      case 'cos':
        if (!config.cos.secretId) {
          issues.push('腾讯云COS SecretId未配置');
        }
        if (!config.cos.secretKey) {
          issues.push('腾讯云COS SecretKey未配置');
        }
        if (!config.cos.bucket) {
          issues.push('腾讯云COS Bucket名称未配置');
        }
        if (!config.cos.region) {
          issues.push('腾讯云COS Region未配置');
        }
        break;
      case 'oss':
        if (!config.oss.accessKeyId) {
          issues.push('阿里云OSS AccessKeyId未配置');
        }
        if (!config.oss.accessKeySecret) {
          issues.push('阿里云OSS AccessKeySecret未配置');
        }
        if (!config.oss.bucket) {
          issues.push('阿里云OSS Bucket名称未配置');
        }
        if (!config.oss.region) {
          issues.push('阿里云OSS Region未配置');
        }
        break;
      case 'qiniu':
        if (!config.qiniu.accessKey) {
          issues.push('七牛云存储AccessKey未配置');
        }
        if (!config.qiniu.secretKey) {
          issues.push('七牛云存储SecretKey未配置');
        }
        if (!config.qiniu.bucket) {
          issues.push('七牛云存储Bucket名称未配置');
        }
        if (!config.qiniu.domain) {
          issues.push('七牛云存储Domain域名未配置');
        }
        break;
      case 'cloudinary':
        issues.push('Cloudinary支持尚未实现');
        break;
    }

    return {
      configured: issues.length === 0,
      provider: config.provider,
      issues
    };
  }

  /**
   * 监听配置变化
   */
  onConfigChange(callback: (config: MarkdownImageAIWorkflowConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('markdownImageAIWorkflow') || 
          event.affectsConfiguration('markdown.copyFiles') ||
          event.affectsConfiguration('markdown.editor')) {
        callback(this.getConfig());
      }
    });
  }
}

/**
 * 组合配置读取器
 */
export class ConfigReader {
  constructor(
    public vscode: VSCodeConfigReader,
    public plugin: PluginConfigReader
  ) {}

  /**
   * 监听配置变化
   */
  onConfigChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('markdownImageAIWorkflow') || 
          event.affectsConfiguration('markdown.copyFiles') ||
          event.affectsConfiguration('markdown.editor')) {
        callback();
      }
    });
  }
}