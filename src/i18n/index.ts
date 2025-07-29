import * as vscode from 'vscode';

/**
 * 支持的语言类型
 */
export type SupportedLanguage = 'zh-cn' | 'en';

/**
 * 语言文本映射接口
 */
export interface LanguageTexts {
  // 通用
  yes: string;
  no: string;
  cancel: string;
  confirm: string;
  configure: string;
  error: string;
  warning: string;
  success: string;
  
  // 插件状态
  status: {
    disabled: string;
    needsConfig: string;
    uploaderReady: string;
    localImages: string;
    noLocalImages: string;
    clickForMore: string;
    checkConfig: string;
  };
  
  // 上传相关
  upload: {
    uploading: string;
    uploadTo: string;
    uploadSuccess: string;
    uploadFailed: string;
    uploadCurrent: string;
    uploadAll: string;
    currentImageNotFound: string;
    alreadyRemote: string;
    fileNotExist: string;
    enableFirst: string;
    configIncomplete: string;
    unsupportedProvider: string;
    batchUploadConfirm: string;
    batchUploadProgress: string;
    batchUploadResult: {
      allSuccess: string;
      partialSuccess: string;
      allFailed: string;
    };
  };
  
  // 配置相关
  config: {
    checkStatus: string;
    setupRecommended: string;
    vscodeConfig: string;
    pluginConfig: string;
    configured: string;
    needsConfiguration: string;
    vscodeNormal: string;
    currentProvider: string;
    applyRecommended: string;
    viewSettings: string;
    recommendedApplied: string;
    applyFailed: string;
    recommendedPrompt: string;
  };
  
  // 图片管理
  images: {
    noImageAtCursor: string;
    noLocalImagesFound: string;
    localImagesFound: string;
    selectToNavigate: string;
    fileExists: string;
    fileNotExists: string;
    lineNumber: string;
    uploadThis: string;
    showLocalImages: string;
  };
  
  // 快速操作
  quickActions: {
    title: string;
    checkConfigStatus: string;
    checkConfigDesc: string;
    checkConfigDetail: string;
    uploadCurrentImage: string;
    uploadCurrentDesc: string;
    uploadCurrentDetail: string;
    batchUpload: string;
    batchUploadDesc: string;
    batchUploadDetail: string;
    showImages: string;
    showImagesDesc: string;
    showImagesDetail: string;
    notMarkdownFile: string;
    notMarkdownDesc: string;
    notMarkdownDetail: string;
    pluginSettings: string;
    pluginSettingsDesc: string;
    pluginSettingsDetail: string;
    vscodeSettings: string;
    vscodeSettingsDesc: string;
    vscodeSettingsDetail: string;
  };
  
  // Code Action
  codeAction: {
    uploadToImageHost: string;
    imageFileNotFound: string;
  };
  
  // 错误消息
  errors: {
    noActiveEditor: string;
    notMarkdownFile: string;
    initializationFailed: string;
    uploadFailed: string;
    configurationError: string;
    deleteLocalFileFailed: string;
    handleUploadResultFailed: string;
    batchUploadFailed: string;
    batchUploadException: string;
  };
}

/**
 * 国际化管理类
 */
export class I18n {
  private static instance: I18n;
  private currentLanguage: SupportedLanguage;
  private texts: Record<SupportedLanguage, LanguageTexts>;

  private constructor() {
    this.currentLanguage = this.detectLanguage();
    this.texts = {} as Record<SupportedLanguage, LanguageTexts>;
    this.loadLanguageTexts();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  /**
   * 检测当前语言环境
   */
  private detectLanguage(): SupportedLanguage {
    // 1. 优先使用插件配置的语言
    const config = vscode.workspace.getConfiguration('markdownImageAIWorkflow');
    const configuredLanguage = config.get<string>('language', 'auto');
    
    if (configuredLanguage === 'zh-cn' || configuredLanguage === 'en') {
      return configuredLanguage as SupportedLanguage;
    }

    // 2. 当设置为"auto"或未设置时，使用VSCode的语言设置
    const vscodeLanguage = vscode.env.language;
    
    // 检查是否为中文环境
    if (vscodeLanguage.startsWith('zh')) {
      return 'zh-cn';
    }
    
    // 默认使用英文
    return 'en';
  }

  /**
   * 加载语言文本
   */
  private loadLanguageTexts(): void {
    // 动态导入语言包
    try {
      const zhTexts = require('./locales/zh-cn.json') as LanguageTexts;
      const enTexts = require('./locales/en.json') as LanguageTexts;
      
      this.texts = {
        'zh-cn': zhTexts,
        'en': enTexts
      };
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 加载语言包失败:', error);
      // 如果加载失败，使用硬编码的英文文本作为后备
      this.texts = {
        'zh-cn': this.getDefaultTexts('zh-cn'),
        'en': this.getDefaultTexts('en')
      };
    }
  }

  /**
   * 获取默认文本（后备方案）
   */
  private getDefaultTexts(language: SupportedLanguage): LanguageTexts {
    if (language === 'zh-cn') {
      return {
        yes: '是',
        no: '否',
        cancel: '取消',
        confirm: '确定',
        configure: '配置',
        error: '错误',
        warning: '警告',
        success: '成功',
        status: {
          disabled: '图床上传已禁用',
          needsConfig: '需要配置',
          uploaderReady: '图床已配置',
          localImages: '张本地图片',
          noLocalImages: '无本地图片',
          clickForMore: '点击查看更多选项',
          checkConfig: '点击查看配置状态'
        },
        upload: {
          uploading: '正在上传图片到图床...',
          uploadTo: '上传到',
          uploadSuccess: '图片已上传到',
          uploadFailed: '上传失败',
          uploadCurrent: '上传当前图片',
          uploadAll: '批量上传',
          currentImageNotFound: '光标位置没有检测到图片链接',
          alreadyRemote: '当前图片已经是远程链接，无需上传',
          fileNotExist: '图片文件不存在',
          enableFirst: '图床上传功能已禁用，请在设置中启用',
          configIncomplete: '配置不完整，请检查设置',
          unsupportedProvider: '不支持的图床服务',
          batchUploadConfirm: '张本地图片，是否全部上传到图床？',
          batchUploadProgress: '批量上传图片到图床',
          batchUploadResult: {
            allSuccess: '成功上传',
            partialSuccess: '上传完成：成功',
            allFailed: '上传失败'
          }
        },
        config: {
          checkStatus: '检查配置状态',
          setupRecommended: '设置推荐配置',
          vscodeConfig: 'VSCode 原生配置',
          pluginConfig: '图床上传配置',
          configured: '已配置',
          needsConfiguration: '需要配置',
          vscodeNormal: 'VSCode图片粘贴功能正常',
          currentProvider: '当前使用',
          applyRecommended: '应用推荐配置',
          viewSettings: '查看设置',
          recommendedApplied: '推荐配置已应用',
          applyFailed: '应用配置失败',
          recommendedPrompt: '是否应用推荐的VSCode配置？这将设置图片保存到 assets/{文档名}/ 目录'
        },
        images: {
          noImageAtCursor: '光标位置没有检测到图片链接',
          noLocalImagesFound: '当前文档中没有找到本地图片',
          localImagesFound: '发现',
          selectToNavigate: '选择图片定位到对应位置，或按 Esc 返回',
          fileExists: '文件存在',
          fileNotExists: '文件不存在',
          lineNumber: '第',
          uploadThis: '是否上传此图片到图床？',
          showLocalImages: '查看本地图片'
        },
        quickActions: {
          title: 'Markdown Image AI Workflow - 快速操作',
          checkConfigStatus: '🔧 检查配置状态',
          checkConfigDesc: '查看VSCode和插件配置状态',
          checkConfigDetail: '检查markdown.copyFiles.destination和图床配置',
          uploadCurrentImage: '📤 上传当前图片',
          uploadCurrentDesc: '上传光标位置的图片',
          uploadCurrentDetail: '将光标定位到图片链接上，然后上传到图床',
          batchUpload: '📦 批量上传',
          batchUploadDesc: '上传文档中所有本地图片',
          batchUploadDetail: '一次性上传所有本地图片到图床',
          showImages: '📁 查看本地图片',
          showImagesDesc: '浏览文档中的本地图片',
          showImagesDetail: '查看、定位并选择上传本地图片',
          notMarkdownFile: '📝 当前不是 Markdown 文件',
          notMarkdownDesc: '图片上传功能仅在 Markdown 文件中可用',
          notMarkdownDetail: '请打开一个 .md 文件以使用图片上传功能',
          pluginSettings: '⚙️ 插件设置',
          pluginSettingsDesc: '配置图床服务和上传选项',
          pluginSettingsDetail: '设置GitHub、阿里云OSS、腾讯云COS等图床服务',
          vscodeSettings: '🔗 VSCode设置',
          vscodeSettingsDesc: '配置markdown.copyFiles.destination',
          vscodeSettingsDetail: '设置图片粘贴保存位置'
        },
        codeAction: {
          uploadToImageHost: '🚀 上传图片到图床',
          imageFileNotFound: '⚠️ 图片文件不存在'
        },
        errors: {
          noActiveEditor: '没有活动的编辑器',
          notMarkdownFile: '当前文件不是 Markdown 文件',
          initializationFailed: '初始化失败',
          uploadFailed: '上传失败',
          configurationError: '图床上传配置有问题',
          deleteLocalFileFailed: '删除本地文件失败',
          handleUploadResultFailed: '图片上传成功，但后续处理失败',
          batchUploadFailed: '批量上传失败',
          batchUploadException: '批量上传异常'
        }
      };
    } else {
      return {
        yes: 'Yes',
        no: 'No',
        cancel: 'Cancel',
        confirm: 'Confirm',
        configure: 'Configure',
        error: 'Error',
        warning: 'Warning',
        success: 'Success',
        status: {
          disabled: 'Image upload disabled',
          needsConfig: 'Needs configuration',
          uploaderReady: 'Image host ready',
          localImages: 'local images',
          noLocalImages: 'no local images',
          clickForMore: 'Click for more options',
          checkConfig: 'Click to check configuration'
        },
        upload: {
          uploading: 'Uploading image to image host...',
          uploadTo: 'Upload to',
          uploadSuccess: 'Image uploaded to',
          uploadFailed: 'Upload failed',
          uploadCurrent: 'Upload current image',
          uploadAll: 'Batch upload',
          currentImageNotFound: 'No image link detected at cursor position',
          alreadyRemote: 'Current image is already a remote link, no upload needed',
          fileNotExist: 'Image file does not exist',
          enableFirst: 'Image upload is disabled, please enable it in settings',
          configIncomplete: 'Configuration incomplete, please check settings',
          unsupportedProvider: 'Unsupported image host service',
          batchUploadConfirm: 'local images found, upload all to image host?',
          batchUploadProgress: 'Batch uploading images to image host',
          batchUploadResult: {
            allSuccess: 'Successfully uploaded',
            partialSuccess: 'Upload completed: success',
            allFailed: 'Upload failed'
          }
        },
        config: {
          checkStatus: 'Check configuration status',
          setupRecommended: 'Setup recommended configuration',
          vscodeConfig: 'VSCode Native Configuration',
          pluginConfig: 'Image Upload Configuration',
          configured: 'Configured',
          needsConfiguration: 'Needs configuration',
          vscodeNormal: 'VSCode image paste function is working normally',
          currentProvider: 'Currently using',
          applyRecommended: 'Apply recommended configuration',
          viewSettings: 'View settings',
          recommendedApplied: 'Recommended configuration applied',
          applyFailed: 'Failed to apply configuration',
          recommendedPrompt: 'Apply recommended VSCode configuration? This will set images to be saved in assets/{document name}/ directory'
        },
        images: {
          noImageAtCursor: 'No image link detected at cursor position',
          noLocalImagesFound: 'No local images found in current document',
          localImagesFound: 'Found',
          selectToNavigate: 'Select image to navigate to position, or press Esc to return',
          fileExists: 'File exists',
          fileNotExists: 'File does not exist',
          lineNumber: 'Line',
          uploadThis: 'Upload this image to image host?',
          showLocalImages: 'Show local images'
        },
        quickActions: {
          title: 'Markdown Image AI Workflow - Quick Actions',
          checkConfigStatus: '🔧 Check Configuration Status',
          checkConfigDesc: 'View VSCode and plugin configuration status',
          checkConfigDetail: 'Check markdown.copyFiles.destination and image host configuration',
          uploadCurrentImage: '📤 Upload Current Image',
          uploadCurrentDesc: 'Upload image at cursor position',
          uploadCurrentDetail: 'Position cursor on image link, then upload to image host',
          batchUpload: '📦 Batch Upload',
          batchUploadDesc: 'Upload all local images in document',
          batchUploadDetail: 'Upload all local images to image host at once',
          showImages: '📁 Show Local Images',
          showImagesDesc: 'Browse local images in document',
          showImagesDetail: 'View, navigate and select local images for upload',
          notMarkdownFile: '📝 Not a Markdown File',
          notMarkdownDesc: 'Image upload feature is only available in Markdown files',
          notMarkdownDetail: 'Please open a .md file to use image upload features',
          pluginSettings: '⚙️ Plugin Settings',
          pluginSettingsDesc: 'Configure image host services and upload options',
          pluginSettingsDetail: 'Setup GitHub, Alibaba Cloud OSS, Tencent Cloud COS and other image host services',
          vscodeSettings: '🔗 VSCode Settings',
          vscodeSettingsDesc: 'Configure markdown.copyFiles.destination',
          vscodeSettingsDetail: 'Set image paste save location'
        },
        codeAction: {
          uploadToImageHost: '🚀 Upload image to image host',
          imageFileNotFound: '⚠️ Image file not found'
        },
        errors: {
          noActiveEditor: 'No active editor',
          notMarkdownFile: 'Current file is not a Markdown file',
          initializationFailed: 'Initialization failed',
          uploadFailed: 'Upload failed',
          configurationError: 'Image upload configuration has issues',
          deleteLocalFileFailed: 'Failed to delete local file',
          handleUploadResultFailed: 'Image uploaded successfully, but post-processing failed',
          batchUploadFailed: 'Batch upload failed',
          batchUploadException: 'Batch upload exception'
        }
      };
    }
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * 切换语言
   */
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
  }

  /**
   * 获取文本
   */
  getText(key: string): string {
    const keys = key.split('.');
    let current: any = this.texts[this.currentLanguage];
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        console.warn(`MarkdownImageAIWorkflow: 国际化文本缺失: ${key}`);
        return key; // 返回key作为后备
      }
    }
    
    return typeof current === 'string' ? current : key;
  }

  /**
   * 获取格式化文本
   */
  getTextWithArgs(key: string, ...args: any[]): string {
    let text = this.getText(key);
    
    // 替换占位符 {0}, {1}, {2} 等
    args.forEach((arg, index) => {
      text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
    });
    
    return text;
  }

  /**
   * 刷新语言设置（当配置变化时调用）
   */
  refresh(): void {
    this.currentLanguage = this.detectLanguage();
  }
}

/**
 * 获取国际化实例的快捷函数
 */
export function getI18n(): I18n {
  return I18n.getInstance();
}

/**
 * 获取文本的快捷函数
 */
export function t(key: string, ...args: any[]): string {
  const i18n = getI18n();
  return args.length > 0 ? i18n.getTextWithArgs(key, ...args) : i18n.getText(key);
}