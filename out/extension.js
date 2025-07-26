"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const fs = require("fs");
const configReader_1 = require("./core/configReader");
const pathResolver_1 = require("./core/pathResolver");
const fileWatcher_1 = require("./core/fileWatcher");
const uploader_interface_1 = require("./uploaders/uploader.interface");
const markdownReplacer_1 = require("./utils/markdownReplacer");
const cursorPosition_1 = require("./utils/cursorPosition");
/**
 * 插件主类
 */
class MarkdownImageFlowExtension {
    constructor(context) {
        this.disposables = [];
        // 初始化组件
        this.vsCodeConfigReader = new configReader_1.VSCodeConfigReader();
        this.pluginConfigReader = new configReader_1.PluginConfigReader();
        this.configReader = new configReader_1.ConfigReader(this.vsCodeConfigReader, this.pluginConfigReader);
        this.pathResolver = new pathResolver_1.VSCodePathResolver();
        this.fileWatcher = new fileWatcher_1.ImageFileWatcher(this.configReader, this.pathResolver);
        this.uploaderFactory = new uploader_interface_1.UploaderFactory();
        this.markdownReplacer = new markdownReplacer_1.MarkdownReplacer();
        this.cursorPositioner = new cursorPosition_1.CursorPositioner();
        // 创建状态栏项
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'markdownImageFlow.checkVSCodeConfig';
        context.subscriptions.push(this.statusBarItem);
        this.initialize();
    }
    /**
     * 初始化插件
     */
    async initialize() {
        console.log('MarkdownImageFlow: 插件正在初始化...');
        // 检查配置状态
        await this.updateStatusBar();
        // 延迟启动文件监控，确保workspace完全加载
        setTimeout(() => {
            this.startFileWatching();
        }, 1000);
        // 注册命令
        this.registerCommands();
        // 监听配置变化
        this.setupConfigurationWatcher();
        // 新方案：监听文档变化
        this.setupDocumentWatcher();
        console.log('MarkdownImageFlow: 插件初始化完成');
    }
    /**
     * 启动文件监控
     */
    startFileWatching() {
        const config = this.pluginConfigReader.getConfig();
        if (!config.enabled) {
            console.log('MarkdownImageFlow: 插件已禁用，跳过文件监控');
            return;
        }
        // 调试：输出当前VSCode配置
        const vsCodeConfig = this.vsCodeConfigReader.getCopyFilesDestination();
        console.log('MarkdownImageFlow: 当前VSCode配置:', vsCodeConfig);
        this.fileWatcher.start(async (imageInfo) => {
            await this.handleImageDetected(imageInfo);
        });
        console.log('MarkdownImageFlow: 文件监控已启动');
    }
    /**
     * 处理检测到的图片文件
     */
    async handleImageDetected(imageInfo) {
        try {
            console.log('MarkdownImageFlow: 🖼️ 检测到图片文件:', {
                fileName: imageInfo.fileName,
                filePath: imageInfo.filePath,
                markdownFile: imageInfo.markdownFile,
                relativePath: imageInfo.relativePath
            });
            const config = this.pluginConfigReader.getConfig();
            console.log('MarkdownImageFlow: ⚙️ 当前配置:', {
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
                console.error('MarkdownImageFlow: ❌ 不支持的图床服务:', config.provider);
                vscode.window.showErrorMessage(`不支持的图床服务: ${config.provider}`);
                return;
            }
            console.log('MarkdownImageFlow: 🚀 使用上传器:', uploader.name);
            if (!uploader.isConfigured()) {
                console.warn('MarkdownImageFlow: ⚠️ 上传器配置不完整:', uploader.name);
                vscode.window.showErrorMessage(`${uploader.name} 配置不完整，请检查设置`);
                return;
            }
            // 显示上传进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在上传图片到图床...',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: `上传到 ${uploader.name}` });
                console.log('MarkdownImageFlow: 📤 开始上传到:', uploader.name);
                // 上传图片
                const result = await uploader.upload(imageInfo.filePath);
                console.log('MarkdownImageFlow: 📊 上传结果:', {
                    success: result.success,
                    provider: result.provider,
                    url: result.url ? '✅ 已获取URL' : '❌ 无URL',
                    error: result.error
                });
                if (result.success && result.url) {
                    await this.handleUploadSuccess(imageInfo, result);
                }
                else {
                    await this.handleUploadFailure(imageInfo, result);
                }
            });
        }
        catch (error) {
            console.error('MarkdownImageFlow: 处理图片失败:', error);
            vscode.window.showErrorMessage(`处理图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    /**
     * 处理上传成功
     */
    async handleUploadSuccess(imageInfo, result) {
        if (!result.url || !imageInfo.markdownFile) {
            return;
        }
        try {
            // 替换Markdown中的图片链接
            const replaceResult = await this.markdownReplacer.replaceImageLink(imageInfo.markdownFile, imageInfo.filePath, result.url);
            if (replaceResult.success) {
                // 显示成功消息
                const message = `✅ 图片已上传到 ${result.provider} 并替换链接`;
                vscode.window.showInformationMessage(message);
                // 定位光标到替换位置的末尾
                if (replaceResult.line !== undefined && replaceResult.column !== undefined) {
                    await this.cursorPositioner.positionCursor(imageInfo.markdownFile, replaceResult.line, replaceResult.column, { reveal: true, focus: true });
                }
                // 删除本地文件（如果配置了）
                const config = this.pluginConfigReader.getConfig();
                if (config.deleteLocalAfterUpload) {
                    await this.deleteLocalFile(imageInfo.filePath);
                }
                // 更新状态栏
                this.updateStatusBarWithSuccess();
            }
            else {
                vscode.window.showWarningMessage(`图片上传成功，但替换链接失败: ${replaceResult.error}`);
            }
        }
        catch (error) {
            console.error('MarkdownImageFlow: 处理上传成功结果失败:', error);
            vscode.window.showErrorMessage('图片上传成功，但后续处理失败');
        }
    }
    /**
     * 处理上传失败
     */
    async handleUploadFailure(_imageInfo, result) {
        const errorMessage = `❌ 上传到 ${result.provider} 失败: ${result.error}`;
        vscode.window.showErrorMessage(errorMessage);
        console.error('MarkdownImageFlow: 上传失败:', result.error);
    }
    /**
     * 删除本地文件
     */
    async deleteLocalFile(filePath) {
        try {
            await fs.promises.unlink(filePath);
            console.log('MarkdownImageFlow: 已删除本地文件:', filePath);
        }
        catch (error) {
            console.error('MarkdownImageFlow: 删除本地文件失败:', error);
        }
    }
    /**
     * 注册命令
     */
    registerCommands() {
        // 检查VSCode配置
        const checkConfigCmd = vscode.commands.registerCommand('markdownImageFlow.checkVSCodeConfig', () => this.checkVSCodeConfiguration());
        // 设置推荐配置
        const setupConfigCmd = vscode.commands.registerCommand('markdownImageFlow.setupRecommendedConfig', () => this.setupRecommendedConfiguration());
        // 手动上传当前图片
        const uploadCurrentCmd = vscode.commands.registerCommand('markdownImageFlow.uploadCurrentImage', () => this.uploadCurrentImage());
        this.disposables.push(checkConfigCmd, setupConfigCmd, uploadCurrentCmd);
    }
    /**
     * 检查VSCode配置
     */
    async checkVSCodeConfiguration() {
        // 按需执行环境检测
        logActivationEnvironment();
        const vsCodeStatus = this.vsCodeConfigReader.isVSCodeProperlyConfigured();
        const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
        const items = [
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
            title: 'Image Bed Uploader - 配置状态检查',
            placeHolder: '选择要查看或配置的项目'
        });
        if (selection) {
            if (selection.label.includes('VSCode')) {
                await this.openVSCodeSettings();
            }
            else {
                await this.openPluginSettings();
            }
        }
    }
    /**
     * 设置推荐配置
     */
    async setupRecommendedConfiguration() {
        const config = vscode.workspace.getConfiguration();
        // 推荐的配置
        const recommendedConfig = {
            'markdown.copyFiles.destination': {
                '**/*.md': 'assets/${documentBaseName}/'
            },
            'markdown.editor.drop.copyIntoWorkspace': 'mediaFiles',
            'markdown.editor.filePaste.copyIntoWorkspace': 'mediaFiles'
        };
        const choice = await vscode.window.showInformationMessage('是否应用推荐的VSCode配置？这将设置图片保存到 assets/{文档名}/ 目录', '应用配置', '查看设置', '取消');
        if (choice === '应用配置') {
            try {
                for (const [key, value] of Object.entries(recommendedConfig)) {
                    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
                }
                vscode.window.showInformationMessage('✅ 推荐配置已应用');
                await this.updateStatusBar();
            }
            catch (error) {
                vscode.window.showErrorMessage('应用配置失败: ' + error);
            }
        }
        else if (choice === '查看设置') {
            await this.openVSCodeSettings();
        }
    }
    /**
     * 上传当前图片
     */
    async uploadCurrentImage() {
        const editor = vscode.window.activeTextEditor;
        // 增强的语言和文件检测
        if (!editor) {
            vscode.window.showWarningMessage('没有活动的编辑器');
            console.log('MarkdownImageFlow: uploadCurrentImage - 无活动编辑器');
            return;
        }
        const document = editor.document;
        const languageId = document.languageId;
        const fileName = document.fileName;
        const isMarkdownFile = languageId === 'markdown' || fileName.endsWith('.md') || fileName.endsWith('.markdown');
        console.log('MarkdownImageFlow: uploadCurrentImage - 文件检测:', {
            fileName,
            languageId,
            isMarkdownFile,
            fileExtension: fileName.split('.').pop()
        });
        if (!isMarkdownFile) {
            const message = `当前文件不是 Markdown 文件 (语言: ${languageId}, 文件: ${fileName})`;
            vscode.window.showWarningMessage(message);
            console.warn('MarkdownImageFlow:', message);
            return;
        }
        console.log('MarkdownImageFlow: uploadCurrentImage - 确认为 Markdown 文件，继续处理');
        // TODO: 实现从当前光标位置识别图片并上传的功能
        vscode.window.showInformationMessage('手动上传功能正在开发中...');
    }
    /**
     * 设置配置监听
     */
    setupConfigurationWatcher() {
        const configWatcher = this.configReader.onConfigChange(async () => {
            console.log('MarkdownImageFlow: 配置已更改，重新初始化...');
            // 重新启动文件监控
            this.fileWatcher.dispose();
            this.startFileWatching();
            // 更新状态栏
            await this.updateStatusBar();
        });
        this.disposables.push(configWatcher);
    }
    /**
     * 设置文档变化监听（新方案）
     */
    setupDocumentWatcher() {
        console.log('MarkdownImageFlow: 🔥 设置文档变化监听');
        // 监听文档内容变化
        const documentWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const document = event.document;
            // 只处理 markdown 文件
            if (document.languageId !== 'markdown') {
                return;
            }
            console.log('MarkdownImageFlow: 📝 检测到markdown文档变化:', document.fileName);
            console.log('MarkdownImageFlow: 📝 变化数量:', event.contentChanges.length);
            // 检查变化中是否包含新的图片链接
            for (let i = 0; i < event.contentChanges.length; i++) {
                const change = event.contentChanges[i];
                const newText = change.text;
                console.log(`MarkdownImageFlow: 📝 变化 ${i + 1}:`, {
                    text: newText.substring(0, 100) + (newText.length > 100 ? '...' : ''),
                    length: newText.length,
                    range: change.range
                });
                // 查找图片链接模式
                const imageRegex = /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg))\)/gi;
                let match;
                while ((match = imageRegex.exec(newText)) !== null) {
                    const imagePath = match[2];
                    console.log('MarkdownImageFlow: 🖼️ 发现新的图片链接:', imagePath);
                    // 如果是本地路径，尝试触发上传
                    if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
                        await this.handleNewImageLink(document.fileName, imagePath);
                    }
                }
                if (!newText.includes('![')) {
                    console.log('MarkdownImageFlow: ⚠️ 变化文本中未发现图片链接模式');
                }
            }
        });
        this.disposables.push(documentWatcher);
    }
    /**
     * 处理新发现的图片链接（带重试机制）
     */
    async handleNewImageLink(markdownFile, imagePath) {
        try {
            console.log('MarkdownImageFlow: 🔍 处理新图片链接:', {
                markdownFile,
                imagePath
            });
            // 解析图片的绝对路径
            const path = require('path');
            const markdownDir = path.dirname(markdownFile);
            const absoluteImagePath = path.resolve(markdownDir, imagePath);
            console.log('MarkdownImageFlow: 📁 解析的图片绝对路径:', absoluteImagePath);
            // 等待文件保存完成（带重试机制）
            const imageExists = await this.waitForImageFile(absoluteImagePath);
            if (!imageExists) {
                console.log('MarkdownImageFlow: ❌ 等待超时，图片文件仍不存在:', absoluteImagePath);
                return;
            }
            console.log('MarkdownImageFlow: ✅ 图片文件已确认存在');
            // 模拟 ImageFileInfo
            const imageInfo = {
                fileName: path.basename(absoluteImagePath),
                filePath: absoluteImagePath,
                markdownFile: markdownFile,
                relativePath: imagePath,
                createdTime: new Date()
            };
            console.log('MarkdownImageFlow: 🚀 准备处理图片:', imageInfo);
            // 触发图片处理
            await this.handleImageDetected(imageInfo);
        }
        catch (error) {
            console.error('MarkdownImageFlow: 处理新图片链接失败:', error);
        }
    }
    /**
     * 等待图片文件保存完成
     */
    async waitForImageFile(filePath, maxRetries = 10, interval = 200) {
        const fs = require('fs');
        for (let i = 0; i < maxRetries; i++) {
            console.log(`MarkdownImageFlow: ⏳ 等待图片文件 (${i + 1}/${maxRetries}):`, filePath);
            if (fs.existsSync(filePath)) {
                // 文件存在，再等待一下确保写入完成
                await new Promise(resolve => setTimeout(resolve, 100));
                try {
                    // 尝试读取文件大小，确保文件写入完成
                    const stats = fs.statSync(filePath);
                    if (stats.size > 0) {
                        console.log('MarkdownImageFlow: ✅ 图片文件写入完成，大小:', stats.size, 'bytes');
                        return true;
                    }
                }
                catch (error) {
                    console.log('MarkdownImageFlow: ⚠️ 文件存在但无法读取统计信息:', error);
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
    async updateStatusBar() {
        const vsCodeStatus = this.vsCodeConfigReader.isVSCodeProperlyConfigured();
        const pluginStatus = this.pluginConfigReader.isPluginProperlyConfigured();
        const config = this.pluginConfigReader.getConfig();
        if (!config.enabled) {
            this.statusBarItem.text = '$(cloud-upload) 图床上传已禁用';
            this.statusBarItem.tooltip = '点击查看配置状态';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else if (vsCodeStatus.configured && pluginStatus.configured) {
            this.statusBarItem.text = `$(cloud-upload) ${pluginStatus.provider}`;
            this.statusBarItem.tooltip = `图床上传已启用 - ${pluginStatus.provider}`;
            this.statusBarItem.backgroundColor = undefined;
        }
        else {
            this.statusBarItem.text = '$(cloud-upload) 需要配置';
            this.statusBarItem.tooltip = '点击查看配置问题';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        this.statusBarItem.show();
    }
    /**
     * 更新状态栏为成功状态
     */
    updateStatusBarWithSuccess() {
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
    showConfigurationError(issues) {
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
    async openVSCodeSettings() {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles');
    }
    /**
     * 打开插件设置
     */
    async openPluginSettings() {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdownImageFlow');
    }
    /**
     * 清理资源
     */
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.fileWatcher.dispose();
        this.statusBarItem.dispose();
    }
}
// 插件实例
let extension;
function activate(context) {
    console.log('MarkdownImageFlow: 插件正在激活...');
    console.error('MarkdownImageFlow: 激活开始 - 这是一个测试消息');
    try {
        extension = new MarkdownImageFlowExtension(context);
        // 将extension实例添加到context以便测试
        context.subscriptions.push({
            dispose: () => extension?.dispose()
        });
        console.log('MarkdownImageFlow: 插件激活完成');
        console.error('MarkdownImageFlow: 激活完成 - 这是一个测试消息');
    }
    catch (error) {
        console.error('MarkdownImageFlow: 插件激活失败:', error);
        vscode.window.showErrorMessage(`图床上传插件激活失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}
/**
 * 记录激活环境信息
 */
function logActivationEnvironment() {
    console.log('MarkdownImageFlow: === 环境检测 ===');
    console.log('MarkdownImageFlow: VSCode版本:', vscode.version);
    // 检测当前活动编辑器
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        console.log('MarkdownImageFlow: 当前活动编辑器:', {
            fileName: activeEditor.document.fileName,
            languageId: activeEditor.document.languageId,
            isMarkdown: activeEditor.document.languageId === 'markdown'
        });
    }
    else {
        console.log('MarkdownImageFlow: 无活动编辑器');
    }
    // 检测工作区中的 markdown 文件
    Promise.resolve(vscode.workspace.findFiles('**/*.{md,markdown}', '**/node_modules/**', 10))
        .then(files => {
        console.log('MarkdownImageFlow: 发现 markdown 文件数量:', files.length);
        files.slice(0, 3).forEach(file => {
            console.log('MarkdownImageFlow: 检测到 markdown 文件:', file.fsPath);
        });
    })
        .catch((error) => {
        console.warn('MarkdownImageFlow: 搜索 markdown 文件失败:', error);
    });
    // 检测语言支持
    Promise.resolve(vscode.languages.getLanguages())
        .then(languages => {
        const hasMarkdown = languages.includes('markdown');
        console.log('MarkdownImageFlow: 语言支持检测:', {
            supportedLanguages: languages.length,
            hasMarkdown,
            markdownLanguages: languages.filter(lang => lang.includes('markdown'))
        });
    })
        .catch((error) => {
        console.error('MarkdownImageFlow: 语言支持检测失败:', error);
    });
    console.log('MarkdownImageFlow: === 环境检测完成 ===');
}
function deactivate() {
    console.log('MarkdownImageFlow: 插件正在停用...');
    extension?.dispose();
    extension = undefined;
}
//# sourceMappingURL=extension.js.map