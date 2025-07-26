"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageFileWatcher = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
/**
 * 文件监控器 - 监控VSCode保存的图片文件
 */
class ImageFileWatcher {
    constructor(configReader, pathResolver) {
        this.configReader = configReader;
        this.pathResolver = pathResolver;
        this.watchers = [];
        this.disposables = [];
        this.recentFiles = new Map(); // 用于防止重复处理
        this.DEBOUNCE_TIME = 500; // 防抖时间（毫秒）
    }
    /**
     * 启动文件监控
     */
    start(onImageDetected) {
        this.updateWatchers(onImageDetected);
        // 监听配置变化，重新创建监控器
        const configDisposable = this.configReader.onConfigChange(() => {
            this.updateWatchers(onImageDetected);
        });
        this.disposables.push(configDisposable);
    }
    /**
     * 更新监控器
     */
    updateWatchers(onImageDetected) {
        // 清理旧的监控器
        this.cleanupWatchers();
        const destinationConfig = this.configReader.vscode.getCopyFilesDestination();
        const watchPatterns = this.pathResolver.generateWatchPatterns(destinationConfig);
        console.log('MarkdownImageFlow: 创建文件监控器，模式:', watchPatterns);
        console.log('MarkdownImageFlow: 监控配置来源:', destinationConfig);
        // 调试：显示当前工作区信息
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log('MarkdownImageFlow: 当前工作区:', workspaceFolders?.map(f => f.uri.fsPath));
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.warn('MarkdownImageFlow: ⚠️ 没有工作区，尝试使用全局文件监控');
            // 在无工作区环境下，监控用户文档目录的常见位置
            const globalPatterns = [
                '**/' + watchPatterns[0] // 使用相对路径模式
            ];
            globalPatterns.forEach(pattern => {
                console.log('MarkdownImageFlow: 创建全局监控器，模式:', pattern);
                try {
                    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                    watcher.onDidCreate(uri => {
                        console.log('MarkdownImageFlow: 🔥 全局文件创建事件触发:', uri.fsPath);
                        this.handleFileCreated(uri, onImageDetected, destinationConfig);
                    });
                    watcher.onDidChange(uri => {
                        console.log('MarkdownImageFlow: 🔥 全局文件修改事件触发:', uri.fsPath);
                        this.handleFileChanged(uri, onImageDetected, destinationConfig);
                    });
                    this.watchers.push(watcher);
                }
                catch (error) {
                    console.error('MarkdownImageFlow: 创建全局监控器失败:', error);
                }
            });
            return;
        }
        // 为每个模式创建监控器
        watchPatterns.forEach(pattern => {
            console.log('MarkdownImageFlow: 创建监控器，模式:', pattern);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            // 监控文件创建事件
            watcher.onDidCreate(uri => {
                console.log('MarkdownImageFlow: 🔥 文件创建事件触发:', uri.fsPath);
                this.handleFileCreated(uri, onImageDetected, destinationConfig);
            });
            // 监控文件修改事件（某些情况下文件可能先创建后写入内容）
            watcher.onDidChange(uri => {
                console.log('MarkdownImageFlow: 🔥 文件修改事件触发:', uri.fsPath);
                this.handleFileChanged(uri, onImageDetected, destinationConfig);
            });
            this.watchers.push(watcher);
        });
    }
    /**
     * 处理文件创建事件
     */
    async handleFileCreated(uri, onImageDetected, destinationConfig) {
        if (!this.isImageFile(uri.fsPath)) {
            return;
        }
        // 防抖处理
        if (this.shouldDebounce(uri.fsPath)) {
            return;
        }
        console.log('MarkdownImageFlow: 🔍 检测到新图片文件:', {
            path: uri.fsPath,
            fileName: path.basename(uri.fsPath)
        });
        // 等待文件写入完成
        await this.waitForFileReady(uri.fsPath);
        const imageInfo = await this.createImageFileInfo(uri.fsPath, destinationConfig);
        if (imageInfo) {
            onImageDetected(imageInfo);
        }
    }
    /**
     * 处理文件修改事件
     */
    async handleFileChanged(uri, onImageDetected, destinationConfig) {
        // 只处理最近创建的文件的修改事件
        const now = Date.now();
        const createTime = this.recentFiles.get(uri.fsPath);
        if (!createTime || now - createTime > this.DEBOUNCE_TIME * 2) {
            return;
        }
        await this.handleFileCreated(uri, onImageDetected, destinationConfig);
    }
    /**
     * 防抖处理
     */
    shouldDebounce(filePath) {
        const now = Date.now();
        const lastTime = this.recentFiles.get(filePath);
        if (lastTime && now - lastTime < this.DEBOUNCE_TIME) {
            return true;
        }
        this.recentFiles.set(filePath, now);
        // 清理过期的记录
        setTimeout(() => {
            this.recentFiles.delete(filePath);
        }, this.DEBOUNCE_TIME * 2);
        return false;
    }
    /**
     * 等待文件写入完成
     */
    async waitForFileReady(filePath, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const stats = await fs.promises.stat(filePath);
                if (stats.size > 0) {
                    // 再等待一小段时间确保写入完成
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return;
                }
            }
            catch (error) {
                // 文件可能还不存在，继续等待
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    /**
     * 创建图片文件信息
     */
    async createImageFileInfo(filePath, destinationConfig) {
        try {
            const stats = await fs.promises.stat(filePath);
            const fileName = path.basename(filePath);
            // 尝试找到相关的markdown文件
            const relatedMarkdownFiles = this.pathResolver.findRelatedMarkdownFile(filePath, destinationConfig);
            const markdownFile = await this.findMostLikelyMarkdownFile(filePath, relatedMarkdownFiles);
            // 计算相对路径
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
            const relativePath = workspaceFolder
                ? path.relative(workspaceFolder.uri.fsPath, filePath)
                : filePath;
            return {
                filePath,
                fileName,
                relativePath,
                markdownFile,
                createdTime: stats.birthtime
            };
        }
        catch (error) {
            console.error('MarkdownImageFlow: 创建图片文件信息失败:', error);
            return null;
        }
    }
    /**
     * 找到最可能的markdown文件
     * 优先选择最近编辑的或当前活动的
     */
    async findMostLikelyMarkdownFile(imagePath, candidates) {
        if (candidates.length === 0) {
            return undefined;
        }
        if (candidates.length === 1) {
            return candidates[0];
        }
        // 检查当前活动的编辑器
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && candidates.includes(activeEditor.document.fileName)) {
            return activeEditor.document.fileName;
        }
        // 检查最近打开的文档
        const openDocuments = vscode.workspace.textDocuments;
        for (const doc of openDocuments) {
            if (candidates.includes(doc.fileName)) {
                return doc.fileName;
            }
        }
        // 选择距离图片最近的文件（按路径计算）
        const imageDir = path.dirname(imagePath);
        let closestFile = candidates[0];
        let minDistance = this.calculatePathDistance(imageDir, path.dirname(closestFile));
        for (let i = 1; i < candidates.length; i++) {
            const candidate = candidates[i];
            const distance = this.calculatePathDistance(imageDir, path.dirname(candidate));
            if (distance < minDistance) {
                minDistance = distance;
                closestFile = candidate;
            }
        }
        return closestFile;
    }
    /**
     * 计算路径距离（简单的实现）
     */
    calculatePathDistance(path1, path2) {
        const parts1 = path1.split(path.sep);
        const parts2 = path2.split(path.sep);
        let commonLength = 0;
        const minLength = Math.min(parts1.length, parts2.length);
        for (let i = 0; i < minLength; i++) {
            if (parts1[i] === parts2[i]) {
                commonLength++;
            }
            else {
                break;
            }
        }
        return (parts1.length - commonLength) + (parts2.length - commonLength);
    }
    /**
     * 检查是否是图片文件
     */
    isImageFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
    }
    /**
     * 清理监控器
     */
    cleanupWatchers() {
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers = [];
    }
    /**
     * 停止监控并清理资源
     */
    dispose() {
        this.cleanupWatchers();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.recentFiles.clear();
    }
}
exports.ImageFileWatcher = ImageFileWatcher;
//# sourceMappingURL=fileWatcher.js.map