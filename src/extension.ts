import * as vscode from 'vscode';
import * as fs from 'fs';
import { VSCodeConfigReader, PluginConfigReader, ConfigReader } from './core/configReader';
import { VSCodePathResolver } from './core/pathResolver';
import { ImageFileWatcher } from './core/fileWatcher';
import { UploaderFactory } from './uploaders/uploader.interface';
import { MarkdownReplacer } from './utils/markdownReplacer';
import { CursorPositioner } from './utils/cursorPosition';
import { ImageFileInfo, UploadResult } from './types';
import { ImagePathParser } from './utils/imagePathParser';
import { ImageCodeActionProvider, ImageDiagnosticsProvider } from './providers/imageCodeActionProvider';
import { t, getI18n } from './i18n';

/**
 * 插件主类
 */
class MarkdownImageAIWorkflowExtension {
  private vsCodeConfigReader: VSCodeConfigReader;
  private pluginConfigReader: PluginConfigReader;
  private configReader: ConfigReader;
  private pathResolver: VSCodePathResolver;
  private fileWatcher: ImageFileWatcher;
  private uploaderFactory: UploaderFactory;
  private markdownReplacer: MarkdownReplacer;
  private cursorPositioner: CursorPositioner;
  private disposables: vscode.Disposable[] = [];
  private statusBarItem: vscode.StatusBarItem;
  private codeActionProvider: ImageCodeActionProvider;
  private diagnosticsProvider: ImageDiagnosticsProvider;

  constructor(context: vscode.ExtensionContext) {
    // 初始化组件
    this.vsCodeConfigReader = new VSCodeConfigReader();
    this.pluginConfigReader = new PluginConfigReader();
    this.configReader = new ConfigReader(this.vsCodeConfigReader, this.pluginConfigReader);
    this.pathResolver = new VSCodePathResolver();
    this.fileWatcher = new ImageFileWatcher(this.configReader, this.pathResolver);
    this.uploaderFactory = new UploaderFactory();
    this.markdownReplacer = new MarkdownReplacer();
    this.cursorPositioner = new CursorPositioner();
    this.codeActionProvider = new ImageCodeActionProvider();
    this.diagnosticsProvider = new ImageDiagnosticsProvider();
    
    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'markdownImageAIWorkflow.showQuickActions';
    context.subscriptions.push(this.statusBarItem);
    
    this.initialize();
  }

  /**
   * 初始化插件
   */
  private async initialize(): Promise<void> {
    console.log('MarkdownImageAIWorkflow: 插件正在初始化...');
    
    try {
      // 检查配置状态
      console.log('MarkdownImageAIWorkflow: 正在更新状态栏...');
      await this.updateStatusBar();
      
      // 延迟启动文件监控，确保workspace完全加载
      console.log('MarkdownImageAIWorkflow: 准备启动文件监控...');
      setTimeout(() => {
        this.startFileWatching();
      }, 1000);
      
      // 注册命令
      console.log('MarkdownImageAIWorkflow: 注册命令...');
      this.registerCommands();
      
      // 注册 Code Action Provider
      console.log('MarkdownImageAIWorkflow: 注册 Code Action Provider...');
      this.registerCodeActionProvider();
      
      // 监听配置变化
      console.log('MarkdownImageAIWorkflow: 设置配置监听器...');
      this.setupConfigurationWatcher();
      
      // 新方案：监听文档变化
      console.log('MarkdownImageAIWorkflow: 设置文档变化监听器...');
      this.setupDocumentWatcher();
      
      console.log('MarkdownImageAIWorkflow: ✅ 插件初始化完成');
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: ❌ 初始化失败:', error);
      vscode.window.showErrorMessage(`Markdown Image AI Workflow 初始化失败: ${error}`);
    }
  }

  /**
   * 启动文件监控
   */
  private startFileWatching(): void {
    const config = this.pluginConfigReader.getConfig();
    
    if (!config.enabled) {
      console.log('MarkdownImageAIWorkflow: 插件已禁用，跳过文件监控');
      return;
    }

    // 调试：输出当前VSCode配置
    const vsCodeConfig = this.vsCodeConfigReader.getCopyFilesDestination();
    console.log('MarkdownImageAIWorkflow: 当前VSCode配置:', vsCodeConfig);

    this.fileWatcher.start(async (imageInfo: ImageFileInfo) => {
      await this.handleImageDetected(imageInfo);
    });

    console.log('MarkdownImageAIWorkflow: 文件监控已启动');
  }

  /**
   * 处理检测到的图片文件
   */
  private async handleImageDetected(imageInfo: ImageFileInfo): Promise<void> {
    try {
      console.log('MarkdownImageAIWorkflow: 🖼️ 检测到图片文件:', {
        fileName: imageInfo.fileName,
        filePath: imageInfo.filePath,
        markdownFile: imageInfo.markdownFile,
        relativePath: imageInfo.relativePath
      });
      
      const config = this.pluginConfigReader.getConfig();
      console.log('MarkdownImageAIWorkflow: ⚙️ 当前配置:', {
        enabled: config.enabled,
        provider: config.provider,
        respectVSCodeConfig: config.respectVSCodeConfig
      });
      
      // 检查插件配置
      const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
      if (!pluginStatus.configured) {
        this.showConfigurationError(pluginStatus.issues);
        return;
      }

      // 创建上传器
      const uploader = this.uploaderFactory.create(config.provider);
      if (!uploader) {
        console.error('MarkdownImageAIWorkflow: ❌ 不支持的图床服务:', config.provider);
        vscode.window.showErrorMessage(`不支持的图床服务: ${config.provider}`);
        return;
      }

      console.log('MarkdownImageAIWorkflow: 🚀 使用上传器:', uploader.name);

      if (!uploader.isConfigured()) {
        console.warn('MarkdownImageAIWorkflow: ⚠️ 上传器配置不完整:', uploader.name);
        vscode.window.showErrorMessage(`${uploader.name} 配置不完整，请检查设置`);
        return;
      }

      // 显示上传进度
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '正在上传图片到图床...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: `上传到 ${uploader.name}` });
          console.log('MarkdownImageAIWorkflow: 📤 开始上传到:', uploader.name);
          
          // 上传图片
          const result = await uploader.upload(imageInfo.filePath);
          console.log('MarkdownImageAIWorkflow: 📊 上传结果:', {
            success: result.success,
            provider: result.provider,
            url: result.url ? '✅ 已获取URL' : '❌ 无URL',
            error: result.error
          });
          
          if (result.success && result.url) {
            await this.handleUploadSuccess(imageInfo, result);
          } else {
            await this.handleUploadFailure(imageInfo, result);
          }
        }
      );
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 处理图片失败:', error);
      vscode.window.showErrorMessage(`处理图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理上传成功
   */
  private async handleUploadSuccess(
    imageInfo: ImageFileInfo,
    result: UploadResult
  ): Promise<void> {
    if (!result.url || !imageInfo.markdownFile) {
      return;
    }

    try {
      // 替换Markdown中的图片链接
      const replaceResult = await this.markdownReplacer.replaceImageLink(
        imageInfo.markdownFile,
        imageInfo.filePath,
        result.url
      );

      if (replaceResult.success) {
        // 显示成功消息
        const message = `✅ 图片已上传到 ${result.provider} 并替换链接`;
        vscode.window.showInformationMessage(message);
        
        // 定位光标到替换位置的末尾
        if (replaceResult.line !== undefined && replaceResult.column !== undefined) {
          await this.cursorPositioner.positionCursor(
            imageInfo.markdownFile,
            replaceResult.line,
            replaceResult.column,
            { reveal: true, focus: true }
          );
        }

        // 删除本地文件（如果配置了）
        const config = this.pluginConfigReader.getConfig();
        if (config.deleteLocalAfterUpload) {
          await this.deleteLocalFile(imageInfo.filePath);
        }

        // 更新状态栏
        this.updateStatusBarWithSuccess();
      } else {
        vscode.window.showWarningMessage(
          `图片上传成功，但替换链接失败: ${replaceResult.error}`
        );
      }
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 处理上传成功结果失败:', error);
      vscode.window.showErrorMessage('图片上传成功，但后续处理失败');
    }
  }

  /**
   * 处理上传失败
   */
  private async handleUploadFailure(
    _imageInfo: ImageFileInfo,
    result: UploadResult
  ): Promise<void> {
    const errorMessage = `❌ 上传到 ${result.provider} 失败: ${result.error}`;
    vscode.window.showErrorMessage(errorMessage);
    console.error('MarkdownImageAIWorkflow: 上传失败:', result.error);
  }

  /**
   * 删除本地文件
   */
  private async deleteLocalFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
      console.log('MarkdownImageAIWorkflow: 已删除本地文件:', filePath);
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 删除本地文件失败:', error);
    }
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // 检查VSCode配置
    const checkConfigCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.checkVSCodeConfig',
      () => this.checkVSCodeConfiguration()
    );

    // 设置推荐配置
    const setupConfigCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.setupRecommendedConfig',
      () => this.setupRecommendedConfiguration()
    );

    // 手动上传当前图片
    const uploadCurrentCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.uploadCurrentImage',
      () => this.uploadCurrentImage()
    );

    // 批量上传所有本地图片
    const uploadAllCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.uploadAllLocalImages',
      () => this.uploadAllLocalImages()
    );

    // 查看本地图片列表
    const showLocalImagesCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.showLocalImages',
      () => this.showLocalImages()
    );

    // 状态栏快速操作
    const showQuickActionsCmd = vscode.commands.registerCommand(
      'markdownImageAIWorkflow.showQuickActions',
      () => this.showQuickActions()
    );

    this.disposables.push(checkConfigCmd, setupConfigCmd, uploadCurrentCmd, uploadAllCmd, showLocalImagesCmd, showQuickActionsCmd);
  }

  /**
   * 注册 Code Action Provider
   */
  private registerCodeActionProvider(): void {
    // 注册 Code Action Provider for Markdown files
    const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', language: 'markdown' },
      this.codeActionProvider,
      {
        providedCodeActionKinds: ImageCodeActionProvider.providedCodeActionKinds
      }
    );

    this.disposables.push(codeActionDisposable);

    // 设置文档变化监听，用于更新诊断信息
    const diagnosticsWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.languageId === 'markdown') {
        // 延迟更新诊断，避免频繁更新
        setTimeout(() => {
          this.diagnosticsProvider.updateDiagnostics(event.document);
        }, 500);
      }
    });

    // 监听文档打开事件
    const documentOpenWatcher = vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === 'markdown') {
        this.diagnosticsProvider.updateDiagnostics(document);
      }
    });

    // 监听文档关闭事件
    const documentCloseWatcher = vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.languageId === 'markdown') {
        this.diagnosticsProvider.clear();
      }
    });

    this.disposables.push(diagnosticsWatcher, documentOpenWatcher, documentCloseWatcher);

    // 监听活动编辑器变化，更新状态栏
    const activeEditorWatcher = vscode.window.onDidChangeActiveTextEditor(async () => {
      await this.updateStatusBar();
    });
    
    this.disposables.push(activeEditorWatcher);

    // 对当前已打开的markdown文档进行初始诊断
    vscode.workspace.textDocuments.forEach((document) => {
      if (document.languageId === 'markdown') {
        this.diagnosticsProvider.updateDiagnostics(document);
      }
    });
  }

  /**
   * 检查VSCode配置
   */
  private async checkVSCodeConfiguration(): Promise<void> {
    // 按需执行环境检测
    logActivationEnvironment();
    
    const vsCodeStatus = this.vsCodeConfigReader.isVSCodeProperlyConfigured();
    const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();

    const items: vscode.QuickPickItem[] = [
      {
        label: '🔧 VSCode 原生配置',
        description: vsCodeStatus.configured ? '✅ 已配置' : '⚠️ 需要配置',
        detail: vsCodeStatus.issues.join('; ') || 'VSCode图片粘贴功能正常'
      },
      {
        label: '📤 图床上传配置',
        description: pluginStatus.configured ? '✅ 已配置' : '⚠️ 需要配置',
        detail: pluginStatus.issues.join('; ') || `当前使用: ${pluginStatus.provider}`
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      title: 'Markdown Image AI Workflow - 配置状态检查',
      placeHolder: '选择要查看或配置的项目'
    });

    if (selection) {
      if (selection.label.includes('VSCode')) {
        await this.openVSCodeSettings();
      } else {
        await this.openPluginSettings();
      }
    }
  }

  /**
   * 设置推荐配置
   */
  private async setupRecommendedConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    
    // 推荐的配置
    const recommendedConfig = {
      'markdown.copyFiles.destination': {
        '**/*.md': 'assets/${documentBaseName}/'
      },
      'markdown.editor.drop.copyIntoWorkspace': 'mediaFiles',
      'markdown.editor.filePaste.copyIntoWorkspace': 'mediaFiles'
    };

    const choice = await vscode.window.showInformationMessage(
      '是否应用推荐的VSCode配置？这将设置图片保存到 assets/{文档名}/ 目录',
      '应用配置',
      '查看设置',
      '取消'
    );

    if (choice === '应用配置') {
      try {
        for (const [key, value] of Object.entries(recommendedConfig)) {
          await config.update(key, value, vscode.ConfigurationTarget.Workspace);
        }
        vscode.window.showInformationMessage('✅ 推荐配置已应用');
        await this.updateStatusBar();
      } catch (error) {
        vscode.window.showErrorMessage('应用配置失败: ' + error);
      }
    } else if (choice === '查看设置') {
      await this.openVSCodeSettings();
    }
  }

  /**
   * 上传当前图片
   */
  private async uploadCurrentImage(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      vscode.window.showWarningMessage(t('errors.noActiveEditor'));
      return;
    }

    const document = editor.document;
    const languageId = document.languageId;
    const fileName = document.fileName;
    const isMarkdownFile = languageId === 'markdown' || fileName.endsWith('.md') || fileName.endsWith('.markdown');

    console.log('MarkdownImageAIWorkflow: uploadCurrentImage - 文件检测:', {
      fileName,
      languageId,
      isMarkdownFile,
      fileExtension: fileName.split('.').pop()
    });

    if (!isMarkdownFile) {
      const message = t('errors.notMarkdownFile') + ' ' + t('errors.notMarkdownFileDetail', languageId, fileName);
      vscode.window.showWarningMessage(message);
      console.warn('MarkdownImageAIWorkflow:', message);
      return;
    }

    console.log('MarkdownImageAIWorkflow: uploadCurrentImage - 确认为 Markdown 文件，继续处理');
    
    // 解析当前光标位置的图片链接
    const position = editor.selection.active;
    const imageInfo = ImagePathParser.parseImageAtCursor(document, position);
    
    if (!imageInfo) {
      vscode.window.showInformationMessage(t('upload.currentImageNotFound'));
      return;
    }
    
    if (!imageInfo.isLocalPath) {
      vscode.window.showInformationMessage(t('upload.alreadyRemote'));
      return;
    }
    
    if (!imageInfo.fileExists) {
      vscode.window.showWarningMessage(t('upload.fileNotExist') + ': ' + imageInfo.imagePath);
      return;
    }
    
    console.log('MarkdownImageAIWorkflow: 检测到本地图片:', {
      altText: imageInfo.altText,
      imagePath: imageInfo.imagePath,
      absolutePath: imageInfo.absolutePath
    });
    
    // 检查插件配置
    const config = this.pluginConfigReader.getConfig();
    if (!config.enabled) {
      vscode.window.showWarningMessage(t('upload.enableFirst'));
      return;
    }
    
    const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
    if (!pluginStatus.configured) {
      this.showConfigurationError(pluginStatus.issues);
      return;
    }

    // 创建上传器
    const uploader = this.uploaderFactory.create(config.provider);
    if (!uploader) {
      vscode.window.showErrorMessage(t('upload.unsupportedProvider') + ': ' + config.provider);
      return;
    }

    if (!uploader.isConfigured()) {
      vscode.window.showErrorMessage(`${uploader.name} ` + t('upload.configIncomplete'));
      return;
    }

    // 构建 ImageFileInfo 对象
    const imageFileInfo: ImageFileInfo = {
      fileName: require('path').basename(imageInfo.absolutePath!),
      filePath: imageInfo.absolutePath!,
      markdownFile: document.fileName,
      relativePath: imageInfo.imagePath,
      createdTime: new Date()
    };

    // 执行上传
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('upload.uploading'),
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: t('upload.uploadTo') + ' ' + uploader.name });
          console.log('MarkdownImageAIWorkflow: 开始手动上传到:', uploader.name);
          
          const result = await uploader.upload(imageFileInfo.filePath);
          console.log('MarkdownImageAIWorkflow: 手动上传结果:', {
            success: result.success,
            provider: result.provider,
            url: result.url ? '✅ 已获取URL' : '❌ 无URL',
            error: result.error
          });
          
          if (result.success && result.url) {
            await this.handleUploadSuccess(imageFileInfo, result);
          } else {
            await this.handleUploadFailure(imageFileInfo, result);
          }
        }
      );
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 手动上传失败:', error);
      vscode.window.showErrorMessage(t('upload.uploadFailed') + ': ' + (error instanceof Error ? error.message : t('errors.unknownError')));
    }
  }

  /**
   * 批量上传所有本地图片
   */
  private async uploadAllLocalImages(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      vscode.window.showWarningMessage(t('errors.noActiveEditor'));
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'markdown') {
      vscode.window.showWarningMessage(t('errors.notMarkdownFile'));
      return;
    }

    // 检查插件配置
    const config = this.pluginConfigReader.getConfig();
    if (!config.enabled) {
      vscode.window.showWarningMessage(t('upload.enableFirst'));
      return;
    }
    
    const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
    if (!pluginStatus.configured) {
      this.showConfigurationError(pluginStatus.issues);
      return;
    }

    // 查找所有本地图片
    const localImages = ImagePathParser.findAllLocalImages(document);
    const existingImages = localImages.filter(img => img.fileExists);
    
    if (existingImages.length === 0) {
      vscode.window.showInformationMessage(t('images.noLocalImagesFound'));
      return;
    }

    // 确认批量上传
    const choice = await vscode.window.showInformationMessage(
      t('images.localImagesFound', existingImages.length) + ' ' + t('upload.batchUploadConfirm'),
      { modal: true },
      t('confirm'),
      t('cancel')
    );

    if (choice !== t('confirm')) {
      return;
    }

    // 创建上传器
    const uploader = this.uploaderFactory.create(config.provider);
    if (!uploader || !uploader.isConfigured()) {
      vscode.window.showErrorMessage(`${config.provider} ` + t('upload.configIncomplete'));
      return;
    }

    // 批量上传
    let successCount = 0;
    let failCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('upload.batchUploadProgress'),
        cancellable: false
      },
      async (progress) => {
        for (let i = 0; i < existingImages.length; i++) {
          const imageInfo = existingImages[i];
          
          progress.report({
            message: `${t('upload.uploadCurrent')} ${i + 1}/${existingImages.length}: ${imageInfo.imagePath}`,
            increment: (100 / existingImages.length)
          });

          try {
            const imageFileInfo: ImageFileInfo = {
              fileName: require('path').basename(imageInfo.absolutePath!),
              filePath: imageInfo.absolutePath!,
              markdownFile: document.fileName,
              relativePath: imageInfo.imagePath,
              createdTime: new Date()
            };

            const result = await uploader.upload(imageFileInfo.filePath);
            
            if (result.success && result.url) {
              await this.handleUploadSuccess(imageFileInfo, result);
              successCount++;
            } else {
              console.error('MarkdownImageAIWorkflow: 批量上传失败:', result.error);
              failCount++;
            }
          } catch (error) {
            console.error('MarkdownImageAIWorkflow: 批量上传异常:', error);
            failCount++;
          }

          // 短暂延迟，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    );

    // 显示结果
    if (successCount > 0 && failCount === 0) {
      vscode.window.showInformationMessage(t('upload.batchUploadResult.allSuccess', successCount));
    } else if (successCount > 0 && failCount > 0) {
      vscode.window.showWarningMessage(t('upload.batchUploadResult.partialSuccess', successCount, failCount));
    } else {
      vscode.window.showErrorMessage(t('upload.batchUploadResult.allFailed', failCount));
    }
  }

  /**
   * 查看本地图片列表
   */
  private async showLocalImages(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      vscode.window.showWarningMessage(t('errors.noActiveEditor'));
      return;
    }

    const document = editor.document;
    if (document.languageId !== 'markdown') {
      vscode.window.showWarningMessage(t('errors.notMarkdownFile'));
      return;
    }

    // 查找所有本地图片
    const localImages = ImagePathParser.findAllLocalImages(document);
    
    if (localImages.length === 0) {
      vscode.window.showInformationMessage(t('images.noLocalImagesFound'));
      return;
    }

    // 构建选择项
    const items: vscode.QuickPickItem[] = localImages.map((imageInfo) => ({
      label: `${imageInfo.fileExists ? '📁' : '❌'} ${imageInfo.imagePath}`,
      description: imageInfo.fileExists ? t('images.fileExists') : t('images.fileNotExists'),
      detail: `${t('images.lineNumber', imageInfo.startPosition.line + 1)} | ${t('images.altText', imageInfo.altText)}`,
      picked: false
    }));

    // 显示选择器
    const selection = await vscode.window.showQuickPick(items, {
      title: t('images.localImagesFound', localImages.length),
      placeHolder: t('images.selectToNavigate'),
      canPickMany: false
    });

    if (selection) {
      // 定位到选中的图片
      const selectedIndex = items.indexOf(selection);
      const imageInfo = localImages[selectedIndex];
      
      const position = imageInfo.startPosition;
      const newSelection = new vscode.Selection(position, position);
      
      editor.selection = newSelection;
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      
      // 如果文件存在且可以上传，询问是否上传
      if (imageInfo.fileExists) {
        const choice = await vscode.window.showInformationMessage(
          t('images.uploadThis'),
          t('upload.upload'),
          t('cancel')
        );
        
        if (choice === t('upload.upload')) {
          await this.uploadCurrentImage();
        }
      }
    }
  }

  /**
   * 显示快速操作菜单
   */
  private async showQuickActions(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const isMarkdownFile = editor && editor.document.languageId === 'markdown';
    
    // 获取本地图片信息
    let localImageInfo = '';
    if (isMarkdownFile) {
      const localImages = ImagePathParser.findAllLocalImages(editor.document);
      const existingImages = localImages.filter(img => img.fileExists);
      localImageInfo = existingImages.length > 0 ? ` (${existingImages.length} 张本地图片)` : ' (无本地图片)';
    }

    const items: vscode.QuickPickItem[] = [
      {
        label: '🔧 检查配置状态',
        description: '查看VSCode和插件配置状态',
        detail: '检查markdown.copyFiles.destination和图床配置'
      }
    ];

    if (isMarkdownFile) {
      const localImages = ImagePathParser.findAllLocalImages(editor!.document);
      const existingImages = localImages.filter(img => img.fileExists);
      
      items.push(
        {
          label: '📤 上传当前图片',
          description: '上传光标位置的图片',
          detail: '将光标定位到图片链接上，然后上传到图床'
        },
        {
          label: `📦 批量上传${localImageInfo}`,
          description: existingImages.length > 0 ? `上传文档中所有 ${existingImages.length} 张本地图片` : '当前文档无本地图片',
          detail: existingImages.length > 0 ? '一次性上传所有本地图片到图床' : undefined
        },
        {
          label: `📁 查看本地图片${localImageInfo}`,
          description: localImages.length > 0 ? `浏览文档中的 ${localImages.length} 张本地图片` : '当前文档无本地图片',
          detail: localImages.length > 0 ? '查看、定位并选择上传本地图片' : undefined
        }
      );
    } else {
      items.push({
        label: '📝 当前不是 Markdown 文件',
        description: '图片上传功能仅在 Markdown 文件中可用',
        detail: '请打开一个 .md 文件以使用图片上传功能'
      });
    }

    // 添加设置相关选项
    items.push(
      {
        label: '⚙️ 插件设置',
        description: '配置图床服务和上传选项',
        detail: '设置GitHub、阿里云OSS、腾讯云COS等图床服务'
      },
      {
        label: '🔗 VSCode设置',
        description: '配置markdown.copyFiles.destination',
        detail: '设置图片粘贴保存位置'
      }
    );

    const selection = await vscode.window.showQuickPick(items, {
      title: 'Markdown Image AI Workflow - 快速操作',
      placeHolder: '选择要执行的操作'
    });

    if (!selection) {
      return;
    }

    // 执行对应操作
    switch (selection.label) {
      case '🔧 检查配置状态':
        await this.checkVSCodeConfiguration();
        break;
      case '📤 上传当前图片':
        await this.uploadCurrentImage();
        break;
      case `📦 批量上传${localImageInfo}`:
        await this.uploadAllLocalImages();
        break;
      case `📁 查看本地图片${localImageInfo}`:
        await this.showLocalImages();
        break;
      case '⚙️ 插件设置':
        await this.openPluginSettings();
        break;
      case '🔗 VSCode设置':
        await this.openVSCodeSettings();
        break;
    }
  }

  /**
   * 设置配置监听
   */
  private setupConfigurationWatcher(): void {
    const configWatcher = this.configReader.onConfigChange(async () => {
      console.log('MarkdownImageAIWorkflow: 配置已更改，重新初始化...');
      
      // 重新启动文件监控
      this.fileWatcher.dispose();
      this.startFileWatching();
      
      // 更新状态栏
      await this.updateStatusBar();
    });

    // 监听语言配置变化
    const languageWatcher = vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('markdownImageAIWorkflow.language')) {
        console.log('MarkdownImageAIWorkflow: 语言配置已更改，刷新国际化...');
        getI18n().refresh();
        await this.updateStatusBar();
      }
    });

    this.disposables.push(configWatcher, languageWatcher);
  }

  /**
   * 设置文档变化监听（新方案）
   */
  private setupDocumentWatcher(): void {
    console.log('MarkdownImageAIWorkflow: 🔥 设置文档变化监听');
    
    // 监听文档内容变化
    const documentWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
      const document = event.document;
      
      // 只处理 markdown 文件
      if (document.languageId !== 'markdown') {
        return;
      }
      
      console.log('MarkdownImageAIWorkflow: 📝 检测到markdown文档变化:', document.fileName);
      console.log('MarkdownImageAIWorkflow: 📝 变化数量:', event.contentChanges.length);
      
      // 检查变化中是否包含新的图片链接
      for (let i = 0; i < event.contentChanges.length; i++) {
        const change = event.contentChanges[i];
        const newText = change.text;
        
        console.log(`MarkdownImageAIWorkflow: 📝 变化 ${i + 1}:`, {
          text: newText.substring(0, 100) + (newText.length > 100 ? '...' : ''),
          length: newText.length,
          range: change.range
        });
        
        // 查找图片链接模式
        const imageRegex = /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg))\)/gi;
        let match;
        
        while ((match = imageRegex.exec(newText)) !== null) {
          const imagePath = match[2];
          console.log('MarkdownImageAIWorkflow: 🖼️ 发现新的图片链接:', imagePath);
          
          // 如果是本地路径，尝试触发上传
          if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
            await this.handleNewImageLink(document.fileName, imagePath);
          }
        }
        
        if (!newText.includes('![')) {
          console.log('MarkdownImageAIWorkflow: ⚠️ 变化文本中未发现图片链接模式');
        }
      }
    });
    
    this.disposables.push(documentWatcher);
  }

  /**
   * 处理新发现的图片链接（带重试机制）
   */
  private async handleNewImageLink(markdownFile: string, imagePath: string): Promise<void> {
    try {
      console.log('MarkdownImageAIWorkflow: 🔍 处理新图片链接:', {
        markdownFile,
        imagePath
      });
      
      // 解析图片的绝对路径
      const path = require('path');
      const markdownDir = path.dirname(markdownFile);
      const absoluteImagePath = path.resolve(markdownDir, imagePath);
      
      console.log('MarkdownImageAIWorkflow: 📁 解析的图片绝对路径:', absoluteImagePath);
      
      // 等待文件保存完成（带重试机制）
      const imageExists = await this.waitForImageFile(absoluteImagePath);
      if (!imageExists) {
        console.log('MarkdownImageAIWorkflow: ❌ 等待超时，图片文件仍不存在:', absoluteImagePath);
        return;
      }
      
      console.log('MarkdownImageAIWorkflow: ✅ 图片文件已确认存在');
      
      // 模拟 ImageFileInfo
      const imageInfo: ImageFileInfo = {
        fileName: path.basename(absoluteImagePath),
        filePath: absoluteImagePath,
        markdownFile: markdownFile,
        relativePath: imagePath,
        createdTime: new Date()
      };
      
      console.log('MarkdownImageAIWorkflow: 🚀 准备处理图片:', imageInfo);
      
      // 触发图片处理
      await this.handleImageDetected(imageInfo);
      
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 处理新图片链接失败:', error);
    }
  }

  /**
   * 等待图片文件保存完成
   */
  private async waitForImageFile(filePath: string, maxRetries: number = 10, interval: number = 200): Promise<boolean> {
    const fs = require('fs');
    
    for (let i = 0; i < maxRetries; i++) {
      console.log(`MarkdownImageAIWorkflow: ⏳ 等待图片文件 (${i + 1}/${maxRetries}):`, filePath);
      
      if (fs.existsSync(filePath)) {
        // 文件存在，再等待一下确保写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // 尝试读取文件大小，确保文件写入完成
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            console.log('MarkdownImageAIWorkflow: ✅ 图片文件写入完成，大小:', stats.size, 'bytes');
            return true;
          }
        } catch (error) {
          console.log('MarkdownImageAIWorkflow: ⚠️ 文件存在但无法读取统计信息:', error);
        }
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    return false;
  }

  /**
   * 更新状态栏
   */
  private async updateStatusBar(): Promise<void> {
    const vsCodeStatus = this.vsCodeConfigReader.isVSCodeProperlyConfigured();
    const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
    const config = this.pluginConfigReader.getConfig();

    // 获取当前文档的本地图片数量
    let localImageCount = 0;
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      const localImages = ImagePathParser.findAllLocalImages(editor.document);
      localImageCount = localImages.filter(img => img.fileExists).length;
    }

    if (!config.enabled) {
      this.statusBarItem.text = '$(cloud-upload) 图床上传已禁用';
      this.statusBarItem.tooltip = '点击查看配置状态';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (vsCodeStatus.configured && pluginStatus.configured) {
      if (localImageCount > 0) {
        this.statusBarItem.text = `$(cloud-upload) ${pluginStatus.provider} | ${localImageCount} 张本地图片`;
        this.statusBarItem.tooltip = `图床上传已启用 - ${pluginStatus.provider}\n当前文档有 ${localImageCount} 张本地图片待上传\n点击查看更多选项`;
      } else {
        this.statusBarItem.text = `$(cloud-upload) ${pluginStatus.provider}`;
        this.statusBarItem.tooltip = `图床上传已启用 - ${pluginStatus.provider}\n点击查看配置状态`;
      }
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(cloud-upload) 需要配置';
      this.statusBarItem.tooltip = '点击查看配置问题';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    this.statusBarItem.show();
  }

  /**
   * 更新状态栏为成功状态
   */
  private updateStatusBarWithSuccess(): void {
    const originalText = this.statusBarItem.text;
    this.statusBarItem.text = '$(check) 上传成功';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    
    // 3秒后恢复原状态
    setTimeout(() => {
      this.statusBarItem.text = originalText;
      this.statusBarItem.backgroundColor = undefined;
    }, 3000);
  }

  /**
   * 显示配置错误
   */
  private showConfigurationError(issues: string[]): void {
    const message = `图床上传配置有问题: ${issues.join(', ')}`;
    vscode.window.showWarningMessage(message, '查看配置').then(selection => {
      if (selection === '查看配置') {
        this.checkVSCodeConfiguration();
      }
    });
  }

  /**
   * 打开VSCode设置
   */
  private async openVSCodeSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles');
  }

  /**
   * 打开插件设置
   */
  private async openPluginSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'markdownImageAIWorkflow');
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.fileWatcher.dispose();
    this.statusBarItem.dispose();
    this.diagnosticsProvider.dispose();
  }
}

// 插件实例
let extension: MarkdownImageAIWorkflowExtension | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('MarkdownImageAIWorkflow: 插件正在激活...');
  console.error('MarkdownImageAIWorkflow: 激活开始 - 这是一个测试消息');
  
  // 输出插件版本和环境信息
  const packageJson = require('../package.json');
  console.log(`MarkdownImageAIWorkflow: 版本 ${packageJson.version}`);
  console.log(`MarkdownImageAIWorkflow: VSCode版本 ${vscode.version}`);
  console.log(`MarkdownImageAIWorkflow: 工作区文件夹数量: ${vscode.workspace.workspaceFolders?.length || 0}`);
  
  try {
    extension = new MarkdownImageAIWorkflowExtension(context);
    
    // 将extension实例添加到context以便测试
    context.subscriptions.push({
      dispose: () => extension?.dispose()
    });
    
    console.log('MarkdownImageAIWorkflow: 插件激活完成');
    console.error('MarkdownImageAIWorkflow: 激活完成 - 这是一个测试消息');
  } catch (error) {
    console.error('MarkdownImageAIWorkflow: 插件激活失败:', error);
    vscode.window.showErrorMessage(`图床上传插件激活失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 记录激活环境信息
 */
function logActivationEnvironment(): void {
  console.log('MarkdownImageAIWorkflow: === 环境检测 ===');
  console.log('MarkdownImageAIWorkflow: VSCode版本:', vscode.version);
  
  // 检测当前活动编辑器
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    console.log('MarkdownImageAIWorkflow: 当前活动编辑器:', {
      fileName: activeEditor.document.fileName,
      languageId: activeEditor.document.languageId,
      isMarkdown: activeEditor.document.languageId === 'markdown'
    });
  } else {
    console.log('MarkdownImageAIWorkflow: 无活动编辑器');
  }
  
  // 检测工作区中的 markdown 文件
  Promise.resolve(vscode.workspace.findFiles('**/*.{md,markdown}', '**/node_modules/**', 10))
    .then(files => {
      console.log('MarkdownImageAIWorkflow: 发现 markdown 文件数量:', files.length);
      files.slice(0, 3).forEach(file => {
        console.log('MarkdownImageAIWorkflow: 检测到 markdown 文件:', file.fsPath);
      });
    })
    .catch((error: any) => {
      console.warn('MarkdownImageAIWorkflow: 搜索 markdown 文件失败:', error);
    });
  
  // 检测语言支持
  Promise.resolve(vscode.languages.getLanguages())
    .then(languages => {
      const hasMarkdown = languages.includes('markdown');
      console.log('MarkdownImageAIWorkflow: 语言支持检测:', {
        supportedLanguages: languages.length,
        hasMarkdown,
        markdownLanguages: languages.filter(lang => lang.includes('markdown'))
      });
    })
    .catch((error: any) => {
      console.error('MarkdownImageAIWorkflow: 语言支持检测失败:', error);
    });
  
  console.log('MarkdownImageAIWorkflow: === 环境检测完成 ===');
}

export function deactivate() {
  console.log('MarkdownImageAIWorkflow: 插件正在停用...');
  extension?.dispose();
  extension = undefined;
}