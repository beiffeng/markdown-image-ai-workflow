"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigReader = exports.PluginConfigReader = exports.VSCodeConfigReader = void 0;
const vscode = require("vscode");
/**
 * VSCode配置读取器 - 专门处理VSCode原生配置
 */
class VSCodeConfigReader {
    /**
     * 获取VSCode原生的markdown.copyFiles.destination配置
     */
    getCopyFilesDestination() {
        const config = vscode.workspace.getConfiguration('markdown.copyFiles');
        return config.get('destination');
    }
    /**
     * 检查是否启用了图片粘贴功能
     */
    isImagePasteEnabled() {
        const dropConfig = vscode.workspace.getConfiguration('markdown.editor.drop');
        const pasteConfig = vscode.workspace.getConfiguration('markdown.editor.filePaste');
        const dropEnabled = dropConfig.get('copyIntoWorkspace', 'mediaFiles') !== 'never';
        const pasteEnabled = pasteConfig.get('copyIntoWorkspace', 'mediaFiles') !== 'never';
        return dropEnabled || pasteEnabled;
    }
    /**
     * 获取文件覆盖行为配置
     */
    getOverwriteBehavior() {
        const config = vscode.workspace.getConfiguration('markdown.copyFiles');
        return config.get('overwriteBehavior', 'nameIncrementally');
    }
    /**
     * 获取完整的VSCode Markdown配置
     */
    getVSCodeMarkdownConfig() {
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
    isVSCodeProperlyConfigured() {
        const issues = [];
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
exports.VSCodeConfigReader = VSCodeConfigReader;
/**
 * 插件配置读取器
 */
class PluginConfigReader {
    /**
     * 获取插件配置
     */
    getConfig() {
        const config = vscode.workspace.getConfiguration('markdownImageFlow');
        return {
            enabled: config.get('enabled', true),
            provider: config.get('provider', 'smms'),
            respectVSCodeConfig: config.get('respectVSCodeConfig', true),
            fallbackBehavior: config.get('fallbackBehavior', 'sameDirectory'),
            deleteLocalAfterUpload: config.get('deleteLocalAfterUpload', false),
            smms: {
                token: config.get('smms.token', '')
            },
            github: {
                repo: config.get('github.repo', ''),
                token: config.get('github.token', ''),
                branch: config.get('github.branch', 'main')
            }
        };
    }
    /**
     * 检查插件是否正确配置
     */
    isPluginProperlyConfigured() {
        const config = this.getConfig();
        const issues = [];
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
    onConfigChange(callback) {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('markdownImageFlow') ||
                event.affectsConfiguration('markdown.copyFiles') ||
                event.affectsConfiguration('markdown.editor')) {
                callback(this.getConfig());
            }
        });
    }
}
exports.PluginConfigReader = PluginConfigReader;
/**
 * 组合配置读取器
 */
class ConfigReader {
    constructor(vscode, plugin) {
        this.vscode = vscode;
        this.plugin = plugin;
    }
    /**
     * 监听配置变化
     */
    onConfigChange(callback) {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('markdownImageFlow') ||
                event.affectsConfiguration('markdown.copyFiles') ||
                event.affectsConfiguration('markdown.editor')) {
                callback();
            }
        });
    }
}
exports.ConfigReader = ConfigReader;
//# sourceMappingURL=configReader.js.map