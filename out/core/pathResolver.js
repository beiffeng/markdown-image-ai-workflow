"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodePathResolver = void 0;
const vscode = require("vscode");
const path = require("path");
const minimatch_1 = require("minimatch");
/**
 * VSCode路径变量解析器 - 处理VSCode原生路径变量和glob模式匹配
 */
class VSCodePathResolver {
    /**
     * 解析VSCode原生路径变量
     */
    resolveVariables(pattern, markdownFilePath, imageFileName) {
        const variables = this.getPathVariables(markdownFilePath, imageFileName);
        let resolvedPath = pattern;
        // 替换所有支持的变量
        const variableMap = {
            documentFileName: variables.documentFileName,
            documentBaseName: variables.documentBaseName,
            documentExtName: variables.documentExtName,
            documentDirName: variables.documentDirName,
            documentWorkspaceFolder: variables.documentWorkspaceFolder,
            fileName: variables.fileName
        };
        Object.entries(variableMap).forEach(([key, value]) => {
            const variablePattern = new RegExp(`\\$\\{${key}\\}`, 'g');
            resolvedPath = resolvedPath.replace(variablePattern, value);
        });
        return resolvedPath;
    }
    /**
     * 获取VSCode路径变量
     */
    getPathVariables(markdownFilePath, imageFileName) {
        const parsedPath = path.parse(markdownFilePath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(markdownFilePath));
        return {
            documentFileName: parsedPath.base,
            documentBaseName: parsedPath.name,
            documentExtName: parsedPath.ext.substring(1), // 去掉点号
            documentDirName: path.basename(parsedPath.dir),
            documentWorkspaceFolder: workspaceFolder?.uri.fsPath || parsedPath.dir,
            fileName: imageFileName
        };
    }
    /**
     * 根据markdown.copyFiles.destination配置匹配目标路径
     */
    matchDestinationPath(markdownFilePath, imageFileName, destinationConfig) {
        if (!destinationConfig) {
            return null;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(markdownFilePath));
        if (!workspaceFolder) {
            return null;
        }
        // 计算相对于工作区的路径
        const relativePath = path.relative(workspaceFolder.uri.fsPath, markdownFilePath);
        const normalizedPath = relativePath.replace(/\\/g, '/'); // 统一使用正斜杠
        // 遍历配置中的glob模式，找到匹配的
        for (const [globPattern, destinationPattern] of Object.entries(destinationConfig)) {
            if ((0, minimatch_1.minimatch)(normalizedPath, globPattern)) {
                const resolvedPattern = this.resolveVariables(destinationPattern, markdownFilePath, imageFileName);
                const isDirectory = resolvedPattern.endsWith('/');
                // 如果是目录模式，需要拼接文件名
                const finalPath = isDirectory
                    ? path.join(resolvedPattern, imageFileName)
                    : resolvedPattern;
                // 转换为绝对路径
                const absolutePath = path.isAbsolute(finalPath)
                    ? finalPath
                    : path.resolve(path.dirname(markdownFilePath), finalPath);
                const variables = this.getPathVariables(markdownFilePath, imageFileName);
                const variableMap = {
                    documentFileName: variables.documentFileName,
                    documentBaseName: variables.documentBaseName,
                    documentExtName: variables.documentExtName,
                    documentDirName: variables.documentDirName,
                    documentWorkspaceFolder: variables.documentWorkspaceFolder,
                    fileName: variables.fileName
                };
                return {
                    destinationPath: absolutePath,
                    isDirectory,
                    matchedPattern: globPattern,
                    variables: variableMap
                };
            }
        }
        return null;
    }
    /**
     * 获取默认保存路径（当未配置destination时）
     * VSCode默认行为：保存在markdown文件同级目录
     */
    getDefaultSavePath(markdownFilePath, imageFileName) {
        const destinationPath = path.resolve(path.dirname(markdownFilePath), imageFileName);
        const variables = this.getPathVariables(markdownFilePath, imageFileName);
        const variableMap = {
            documentFileName: variables.documentFileName,
            documentBaseName: variables.documentBaseName,
            documentExtName: variables.documentExtName,
            documentDirName: variables.documentDirName,
            documentWorkspaceFolder: variables.documentWorkspaceFolder,
            fileName: variables.fileName
        };
        return {
            destinationPath,
            isDirectory: false,
            variables: variableMap
        };
    }
    /**
     * 预测VSCode会将图片保存到哪里
     * 这是插件的核心功能：完全模拟VSCode的行为
     */
    predictImageSavePath(markdownFilePath, imageFileName, destinationConfig) {
        // 首先尝试匹配用户配置
        const matchedPath = this.matchDestinationPath(markdownFilePath, imageFileName, destinationConfig);
        if (matchedPath) {
            return matchedPath;
        }
        // 回退到默认行为
        return this.getDefaultSavePath(markdownFilePath, imageFileName);
    }
    /**
     * 生成用于文件监控的glob模式
     */
    generateWatchPatterns(destinationConfig) {
        if (!destinationConfig) {
            // 未配置时，监控所有工作区中的图片文件
            return ['**/*.{png,jpg,jpeg,gif,webp,svg}'];
        }
        const patterns = [];
        for (const [, destinationPattern] of Object.entries(destinationConfig)) {
            // 将变量替换为通配符来生成监控模式
            let watchPattern = destinationPattern
                .replace(/\$\{documentBaseName\}/g, '*')
                .replace(/\$\{documentFileName\}/g, '*')
                .replace(/\$\{documentDirName\}/g, '*')
                .replace(/\$\{fileName\}/g, '*.{png,jpg,jpeg,gif,webp,svg}');
            // 如果模式以目录结尾，添加通配符
            if (watchPattern.endsWith('/')) {
                watchPattern += '*.{png,jpg,jpeg,gif,webp,svg}';
            }
            patterns.push(watchPattern);
        }
        // 去重
        return [...new Set(patterns)];
    }
    /**
     * 检查文件路径是否匹配预期的保存位置
     * 用于验证文件是否是VSCode刚刚保存的
     */
    isExpectedPath(actualPath, markdownFilePath, imageFileName, destinationConfig) {
        const predicted = this.predictImageSavePath(markdownFilePath, imageFileName, destinationConfig);
        return path.resolve(actualPath) === path.resolve(predicted.destinationPath);
    }
    /**
     * 从图片路径反向推导可能的markdown文件
     * 用于确定哪个markdown文件触发了图片保存
     */
    findRelatedMarkdownFile(imagePath, destinationConfig) {
        console.log('MarkdownImageFlow: findRelatedMarkdownFile - 开始查找相关文件:', imagePath);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.warn('MarkdownImageFlow: findRelatedMarkdownFile - 无工作区文件夹');
            return [];
        }
        const possibleMarkdownFiles = [];
        const imageFileName = path.basename(imagePath);
        try {
            for (const workspaceFolder of workspaceFolders) {
                const workspacePath = workspaceFolder.uri.fsPath;
                console.log('MarkdownImageFlow: findRelatedMarkdownFile - 检查工作区:', workspacePath);
                // 如果没有配置，检查同级目录下的markdown文件
                if (!destinationConfig) {
                    console.log('MarkdownImageFlow: findRelatedMarkdownFile - 无配置，使用默认查找');
                    const imageDir = path.dirname(imagePath);
                    // 同步查找，避免异步问题
                    try {
                        const pattern = new vscode.RelativePattern(imageDir, '*.{md,markdown}');
                        const markdownFiles = vscode.workspace.findFiles(pattern, null, 50);
                        Promise.resolve(markdownFiles)
                            .then(files => {
                            console.log('MarkdownImageFlow: findRelatedMarkdownFile - 找到同级目录 markdown 文件:', files.length);
                            files.forEach(file => {
                                console.log('MarkdownImageFlow: findRelatedMarkdownFile - 添加候选文件:', file.fsPath);
                                possibleMarkdownFiles.push(file.fsPath);
                            });
                        })
                            .catch((error) => {
                            console.error('MarkdownImageFlow: findRelatedMarkdownFile - 查找同级目录文件失败:', error);
                        });
                    }
                    catch (error) {
                        console.error('MarkdownImageFlow: findRelatedMarkdownFile - 创建搜索模式失败:', error);
                    }
                    continue;
                }
                // 根据配置推导可能的markdown文件位置
                console.log('MarkdownImageFlow: findRelatedMarkdownFile - 使用配置查找:', destinationConfig);
                for (const [globPattern] of Object.entries(destinationConfig)) {
                    try {
                        console.log('MarkdownImageFlow: findRelatedMarkdownFile - 检查模式:', globPattern);
                        // 在工作区中搜索匹配的 markdown 文件
                        const pattern = new vscode.RelativePattern(workspacePath, globPattern);
                        const markdownFiles = vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
                        Promise.resolve(markdownFiles)
                            .then(files => {
                            console.log('MarkdownImageFlow: findRelatedMarkdownFile - 模式匹配文件数:', files.length);
                            files.forEach(file => {
                                try {
                                    const predicted = this.predictImageSavePath(file.fsPath, imageFileName, destinationConfig);
                                    if (path.resolve(predicted.destinationPath) === path.resolve(imagePath)) {
                                        console.log('MarkdownImageFlow: findRelatedMarkdownFile - 路径匹配成功:', file.fsPath);
                                        possibleMarkdownFiles.push(file.fsPath);
                                    }
                                }
                                catch (error) {
                                    console.error('MarkdownImageFlow: findRelatedMarkdownFile - 路径预测失败:', error);
                                }
                            });
                        })
                            .catch((error) => {
                            console.error('MarkdownImageFlow: findRelatedMarkdownFile - 查找配置匹配文件失败:', error);
                        });
                    }
                    catch (error) {
                        console.error('MarkdownImageFlow: findRelatedMarkdownFile - 处理 glob 模式失败:', error);
                    }
                }
            }
        }
        catch (error) {
            console.error('MarkdownImageFlow: findRelatedMarkdownFile - 整体查找过程失败:', error);
        }
        console.log('MarkdownImageFlow: findRelatedMarkdownFile - 查找完成，候选文件数:', possibleMarkdownFiles.length);
        return possibleMarkdownFiles;
    }
}
exports.VSCodePathResolver = VSCodePathResolver;
//# sourceMappingURL=pathResolver.js.map