const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

// Browser-specific build configurations
const browsers = {
    chrome: {
        manifest: 'manifest.json',
        outputDir: 'dist/chrome',
        packageName: 'password-checker-chrome.zip'
    },
    firefox: {
        manifest: 'manifest.firefox.json',
        outputDir: 'dist/firefox',
        packageName: 'password-checker-firefox.zip'
    },
    safari: {
        manifest: 'manifest.safari.json',
        outputDir: 'dist/safari',
        packageName: 'password-checker-safari.zip'
    }
};

// Files to copy for each browser
const commonFiles = [
    'popup.html',
    'popup.js',
    'popup.css',
    'content.js',
    'background.js',
    'password_cracker.js',
    'browser-polyfill.js',
    'icons/*',
    'data/*'
];

// Create build directories
function createDirectories() {
    Object.values(browsers).forEach(browser => {
        if (!fs.existsSync(browser.outputDir)) {
            fs.mkdirSync(browser.outputDir, { recursive: true });
        }
    });
}

// Copy files to build directory
function copyFiles(browserConfig) {
    commonFiles.forEach(file => {
        if (file.includes('*')) {
            // Handle directories with wildcards
            const dirPath = file.split('/*')[0];
            const files = fs.readdirSync(dirPath);
            files.forEach(f => {
                const sourcePath = path.join(dirPath, f);
                const destPath = path.join(browserConfig.outputDir, dirPath, f);
                
                // Create directory if it doesn't exist
                if (!fs.existsSync(path.dirname(destPath))) {
                    fs.mkdirSync(path.dirname(destPath), { recursive: true });
                }
                
                fs.copyFileSync(sourcePath, destPath);
            });
        } else {
            const destPath = path.join(browserConfig.outputDir, file);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(path.dirname(destPath))) {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
            }
            
            fs.copyFileSync(file, destPath);
        }
    });
}

// Copy and rename manifest file
function copyManifest(browserConfig) {
    fs.copyFileSync(
        browserConfig.manifest,
        path.join(browserConfig.outputDir, 'manifest.json')
    );
}

// Create ZIP archive
function createZip(browserConfig) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(path.join('dist', browserConfig.packageName));
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(browserConfig.outputDir, false);
        archive.finalize();
    });
}

// Build for a specific browser
async function buildForBrowser(browserName) {
    const config = browsers[browserName];
    console.log(`Building for ${browserName}...`);
    
    // Create build directory
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // Copy files
    copyFiles(config);
    copyManifest(config);
    
    // Create ZIP
    await createZip(config);
    
    console.log(`${browserName} build completed!`);
}

// Main build process
async function build() {
    try {
        // Create dist directory
        if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist');
        }
        
        // Build for each browser
        for (const browser of Object.keys(browsers)) {
            await buildForBrowser(browser);
        }
        
        console.log('All builds completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

// Run the build process
build(); 