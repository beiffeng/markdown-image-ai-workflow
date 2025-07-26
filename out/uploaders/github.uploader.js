"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubUploader = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const node_fetch_1 = require("node-fetch");
/**
 * GitHub图床上传器
 * 使用GitHub仓库作为图床，通过GitHub API上传文件
 */
class GitHubUploader {
    constructor() {
        this.name = 'GitHub';
        this.API_BASE = 'https://api.github.com';
        this.MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (GitHub限制)
    }
    /**
     * 上传图片到GitHub仓库
     */
    async upload(filePath) {
        try {
            const config = this.getConfig();
            if (!config.repo || !config.token) {
                return {
                    success: false,
                    error: 'GitHub仓库名称或Personal Access Token未配置',
                    provider: this.name
                };
            }
            // 检查文件大小
            const stats = await fs.promises.stat(filePath);
            if (stats.size > this.MAX_FILE_SIZE) {
                return {
                    success: false,
                    error: `文件大小超过GitHub限制（${this.MAX_FILE_SIZE / 1024 / 1024}MB）`,
                    provider: this.name
                };
            }
            // 读取文件并转换为base64
            const fileBuffer = await fs.promises.readFile(filePath);
            const base64Content = fileBuffer.toString('base64');
            const fileName = path.basename(filePath);
            // 生成文件路径（按日期组织）
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const remotePath = `images/${year}/${month}/${fileName}`;
            // 检查文件是否已存在
            const existingFile = await this.checkFileExists(config.repo, remotePath, config.token);
            if (existingFile) {
                return {
                    success: true,
                    url: existingFile.download_url,
                    provider: this.name
                };
            }
            // 上传文件
            const uploadUrl = `${this.API_BASE}/repos/${config.repo}/contents/${remotePath}`;
            const uploadData = {
                message: `Upload ${fileName} via VSCode Image Bed Uploader`,
                content: base64Content,
                branch: config.branch
            };
            const response = await (0, node_fetch_1.default)(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'VSCode-ImageBedUploader/1.0'
                },
                body: JSON.stringify(uploadData)
            });
            if (response.status === 201) {
                // 使用raw.githubusercontent.com链接以获得更好的加载速度
                const rawUrl = `https://raw.githubusercontent.com/${config.repo}/${config.branch}/${remotePath}`;
                return {
                    success: true,
                    url: rawUrl,
                    provider: this.name
                };
            }
            else {
                // 获取详细错误信息
                try {
                    const errorResponse = await response.text();
                    console.error('MarkdownImageFlow: GitHub API错误详情:', {
                        status: response.status,
                        statusText: response.statusText,
                        response: errorResponse
                    });
                }
                catch (e) {
                    console.error('MarkdownImageFlow: 无法读取错误响应');
                }
                let errorMsg = `GitHub API返回状态码: ${response.status}`;
                if (response.status === 403) {
                    errorMsg += ' - Token权限不足，请检查Token是否有repo权限';
                }
                else if (response.status === 404) {
                    errorMsg += ' - 仓库不存在或Token无权访问';
                }
                else if (response.status === 401) {
                    errorMsg += ' - Token无效或已过期';
                }
                return {
                    success: false,
                    error: errorMsg,
                    provider: this.name
                };
            }
        }
        catch (error) {
            console.error('MarkdownImageFlow: GitHub上传失败:', error);
            let errorMsg = '上传失败';
            if (error instanceof Error) {
                if (error.message.includes('401')) {
                    errorMsg = 'GitHub Personal Access Token无效';
                }
                else if (error.message.includes('403')) {
                    errorMsg = 'GitHub API限制或权限不足';
                }
                else if (error.message.includes('404')) {
                    errorMsg = 'GitHub仓库不存在或无权限访问';
                }
                else if (error.message.includes('409')) {
                    errorMsg = '文件已存在且内容不同';
                }
                else if (error.message.includes('422')) {
                    errorMsg = '请求参数错误，请检查仓库配置';
                }
                else if (error.name === 'AbortError') {
                    errorMsg = '上传超时，请检查网络连接';
                }
                else {
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
    async checkFileExists(repo, filePath, token) {
        try {
            const url = `${this.API_BASE}/repos/${repo}/contents/${filePath}`;
            const response = await (0, node_fetch_1.default)(url, {
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'VSCode-ImageBedUploader/1.0'
                }
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        }
        catch (error) {
            // 文件不存在或其他错误
            return null;
        }
    }
    /**
     * 检查是否已配置
     */
    isConfigured() {
        const config = this.getConfig();
        return !!(config.repo && config.token);
    }
    /**
     * 获取配置
     */
    getConfig() {
        const config = vscode.workspace.getConfiguration('markdownImageFlow.github');
        return {
            repo: config.get('repo', ''),
            token: config.get('token', ''),
            branch: config.get('branch', 'main')
        };
    }
    /**
     * 验证配置
     */
    async validateConfig() {
        const config = this.getConfig();
        if (!config.repo) {
            return { valid: false, error: '仓库名称未配置' };
        }
        if (!config.token) {
            return { valid: false, error: 'Personal Access Token未配置' };
        }
        // 验证仓库格式
        if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(config.repo)) {
            return { valid: false, error: '仓库名称格式错误，应为 username/repo' };
        }
        try {
            // 测试API访问权限
            const url = `${this.API_BASE}/repos/${config.repo}`;
            const response = await (0, node_fetch_1.default)(url, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'User-Agent': 'VSCode-ImageBedUploader/1.0'
                }
            });
            if (response.status === 200) {
                return { valid: true };
            }
            else if (response.status === 401) {
                return { valid: false, error: 'Personal Access Token无效' };
            }
            else if (response.status === 404) {
                return { valid: false, error: '仓库不存在或无权限访问' };
            }
            else {
                return { valid: false, error: '无法访问仓库' };
            }
        }
        catch (error) {
            return { valid: false, error: '网络错误或配置无效' };
        }
    }
    /**
     * 获取配置状态信息
     */
    getConfigStatus() {
        const config = this.getConfig();
        const configured = this.isConfigured();
        return {
            configured,
            repo: config.repo,
            branch: config.branch,
            status: configured
                ? `已配置仓库: ${config.repo} (${config.branch}分支)`
                : '未配置GitHub仓库信息'
        };
    }
}
exports.GitHubUploader = GitHubUploader;
//# sourceMappingURL=github.uploader.js.map