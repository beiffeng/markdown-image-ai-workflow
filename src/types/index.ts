/**
 * VSCode原生配置类型定义
 */
export interface VSCodeMarkdownConfig {
  'markdown.copyFiles.destination'?: Record<string, string>;
  'markdown.copyFiles.overwriteBehavior'?: 'nameIncrementally' | 'overwrite';
  'markdown.editor.drop.copyIntoWorkspace'?: 'always' | 'mediaFiles' | 'never';
  'markdown.editor.filePaste.copyIntoWorkspace'?: 'always' | 'mediaFiles' | 'never';
}

/**
 * 插件配置类型定义
 */
export interface MarkdownImageAIWorkflowConfig {
  enabled: boolean;
  provider: 'smms' | 'github' | 'cloudinary' | 'cos';
  respectVSCodeConfig: boolean;
  fallbackBehavior: 'sameDirectory' | 'disable' | 'prompt';
  deleteLocalAfterUpload: boolean;
  smms: {
    token?: string;
  };
  github: {
    repo?: string;
    token?: string;
    branch: string;
  };
  cos: {
    secretId?: string;
    secretKey?: string;
    bucket?: string;
    region?: string;
    path?: string;
  };
}

/**
 * 文件信息
 */
export interface ImageFileInfo {
  filePath: string;
  fileName: string;
  relativePath: string;
  markdownFile?: string;
  createdTime: Date;
}

/**
 * 路径解析结果
 */
export interface PathResolveResult {
  destinationPath: string;
  isDirectory: boolean;
  matchedPattern?: string;
  variables: Record<string, string>;
}

/**
 * 上传结果
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  provider: string;
}

/**
 * 图床上传器接口
 */
export interface ImageUploader {
  readonly name: string;
  upload(filePath: string): Promise<UploadResult>;
  isConfigured(): boolean;
}

/**
 * VSCode路径变量
 */
export interface VSCodePathVariables {
  documentFileName: string;
  documentBaseName: string;
  documentExtName: string;
  documentDirName: string;
  documentWorkspaceFolder: string;
  fileName: string;
}