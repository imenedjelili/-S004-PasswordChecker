// Import PasswordCracker
import { PasswordCracker } from './password_cracker.js';

// SHA-1 function implementation
async function sha1(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hash = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Store the currently detected password
let currentPassword = '';

// Initialize password cracker
let passwordCracker = new PasswordCracker();

// Store password usage history
const PASSWORD_HISTORY = {
    // Structure: { hashedPassword: { domains: Set<string>, lastUsed: Date } }
};

// Password validation settings
const PASSWORD_REQUIREMENTS = {
    minLength: 12,
    minEntropy: 60,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
    maxRepeatingChars: 2,
    preventReuse: true
};

// Function to calculate password entropy
function calculateEntropy(password) {
    let charset = 0;
    if (/[a-z]/.test(password)) charset += 26;  // lowercase
    if (/[A-Z]/.test(password)) charset += 26;  // uppercase
    if (/[0-9]/.test(password)) charset += 10;  // numbers
    if (/[^a-zA-Z0-9]/.test(password)) charset += 32;  // special characters
    
    return Math.log2(Math.pow(charset, password.length));
}

// Function to hash a password (for local storage)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Function to check password reuse
async function checkPasswordReuse(password, currentDomain) {
    const issues = [];
    console.log('Checking password reuse for domain:', currentDomain);

    // Move declaration here
    let hashedPassword = "";

    try {
        // 1. Check local password history
        hashedPassword = await hashPassword(password);
        console.log('Checking local history...');
        
        const result = await chrome.storage.local.get(['passwordHistory']);
        const passwordHistory = result.passwordHistory || {};
        
        if (passwordHistory[hashedPassword]) {
            const domains = passwordHistory[hashedPassword].domains;
            console.log('Found password used in domains:', domains);
            if (domains.length > 0 && !domains.includes(currentDomain)) {
                issues.push(`⚠️ Password was previously used on: ${domains.join(', ')}`);
            }
        }

        // 2. Check browser's password manager using chrome.passwords API
        console.log('Checking Chrome password manager...');
        try {
            // First try using the newer PasswordCredential API
            if (window.PasswordCredential) {
                const cred = await navigator.credentials.get({
                    password: true,
                    mediation: 'optional'
                });
                
                if (cred && cred instanceof PasswordCredential) {
                    // Compare the password (safely)
                    const credPassword = cred.password;
                    if (credPassword === password) {
                        issues.push('⚠️ This password matches one stored in your password manager');
                        console.log('Found matching password in credential manager');
                    }
                }
            }

            // Also check saved passwords in chrome.storage
            const savedPasswords = await chrome.storage.local.get(['savedPasswords']);
            if (savedPasswords && savedPasswords.savedPasswords) {
                const matches = savedPasswords.savedPasswords.filter(saved => 
                    saved.hashedPassword === hashedPassword && 
                    saved.domain !== currentDomain
                );
                
                if (matches.length > 0) {
                    const domains = matches.map(m => m.domain);
                    issues.push(`⚠️ This password matches ones used on: ${domains.join(', ')}`);
                    console.log('Found matching passwords in storage:', domains);
                }
            }
        } catch (error) {
            console.log('Password manager check error:', error);
        }

        // 3. Check Have I Been Pwned API
        console.log('Checking HaveIBeenPwned...');
        const pwnedResult = await checkHaveIBeenPwned(password);
        if (pwnedResult.breachCount > 0) {
            issues.push(`⚠️ This password has appeared in ${pwnedResult.breachCount} data breaches!`);
            if (pwnedResult.breaches && pwnedResult.breaches.length > 0) {
                issues.push('🔴 Affected services: ' + pwnedResult.breaches.join(', '));
            }
            console.log('Found password in data breaches:', pwnedResult.breachCount);
        }

    } catch (error) {
        console.error('Error in password reuse check:', error);
    }

    // Store this password for future checks
    try {
        const savedPasswords = await chrome.storage.local.get(['savedPasswords']) || { savedPasswords: [] };
        savedPasswords.savedPasswords = savedPasswords.savedPasswords || [];
        
        // Add new password entry if it doesn't exist
        if (!savedPasswords.savedPasswords.some(p => p.hashedPassword === hashedPassword && p.domain === currentDomain)) {
            savedPasswords.savedPasswords.push({
                hashedPassword: hashedPassword,
                domain: currentDomain,
                timestamp: new Date().toISOString()
            });
            await chrome.storage.local.set({ savedPasswords: savedPasswords.savedPasswords });
            console.log('Stored new password entry for future checks');
        }
    } catch (error) {
        console.error('Error storing password for future checks:', error);
    }

    console.log('Password check issues found:', issues.length);
    return issues;
}

// Function to check Have I Been Pwned with k-anonymity
async function checkHaveIBeenPwned(password) {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5).toUpperCase();

    try {
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        const data = await response.text();
        const hashLines = data.split('\r\n');
        
        for (const line of hashLines) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix === suffix) {
                // Also fetch breach details if available
                try {
                    const breachResponse = await fetch('https://haveibeenpwned.com/api/v3/breaches');
                    const breaches = await breachResponse.json();
                    const relevantBreaches = breaches
                        .filter(breach => breach.DataClasses.includes('Passwords'))
                        .map(breach => breach.Name);

                    return {
                        breachCount: parseInt(count),
                        breaches: relevantBreaches
                    };
                } catch (error) {
                    return { breachCount: parseInt(count) };
                }
            }
        }
        return { breachCount: 0 };
    } catch (error) {
        console.error('Error checking HIBP:', error);
        throw error;
    }
}

// Function to store password usage
async function storePasswordUsage(password, domain) {
    if (!domain) {
        console.log('No domain provided for password storage');
        return;
    }

    try {
        const hashedPassword = await hashPassword(password);
        console.log('Storing password usage for domain:', domain);

        // Get existing password history
        const result = await chrome.storage.local.get(['passwordHistory']);
        const passwordHistory = result.passwordHistory || {};

        // Update or create entry
        if (!passwordHistory[hashedPassword]) {
            passwordHistory[hashedPassword] = {
                domains: [],
                lastUsed: new Date().toISOString()
            };
        }

        // Add domain if not already present
        if (!passwordHistory[hashedPassword].domains.includes(domain)) {
            passwordHistory[hashedPassword].domains.push(domain);
        }
        passwordHistory[hashedPassword].lastUsed = new Date().toISOString();

        // Store updated history
        await chrome.storage.local.set({ passwordHistory: passwordHistory });
        console.log('Successfully stored password usage');

    } catch (error) {
        console.error('Error storing password usage:', error);
    }
}

// Function to safely get extension ID
function getExtensionId() {
    try {
        return chrome.runtime?.id;
    } catch (error) {
        console.log('Error getting extension ID:', error);
        return null;
    }
}

// Function to safely send message to content script
async function safeSendMessageToContent(tabId, message) {
    try {
        if (!getExtensionId()) {
            console.log('Extension context not available');
            return;
        }
        
        await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
        console.log('Error sending message to content script:', error);
    }
}

// Function to safely execute script
async function safeExecuteScript(tabId, details) {
    try {
        if (!getExtensionId()) {
            console.log('Extension context not available');
            return;
        }
        
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            ...details
        });
    } catch (error) {
        console.log('Error executing script:', error);
    }
}

// Function to safely inject content script
async function safeInjectContentScript(tabId) {
    try {
        if (!getExtensionId()) {
            console.log('Extension context not available');
            return;
        }
        
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
    } catch (error) {
        console.log('Error injecting content script:', error);
    }
}

// --- Password Cracking Integration ---
const CRACKING_SERVER_URL = 'http://localhost:5000/api'; // Replace with your server

// Send hash to backend to start cracking
async function startCracking(password) {
    const hash = await hashPassword(password);
    try {
        await fetch(`${CRACKING_SERVER_URL}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash })
        });
        // Start polling for result
        pollCrackStatus(hash);
    } catch (e) {
        console.error('Error starting cracking:', e);
    }
}

// Poll for cracking result
async function pollCrackStatus(hash) {
    let attempts = 0;
    const maxAttempts = 60; // e.g., poll for up to 10 minutes
    const interval = 10000; // 10 seconds
    const poll = async () => {
        try {
            const response = await fetch(`${CRACKING_SERVER_URL}/status?hash=${hash}`);
            const data = await response.json();
            if (data.status === 'cracked') {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/warning_icon.png',
                    title: 'Password Cracked!',
                    message: 'Your password has been cracked. Please change it immediately.',
                    priority: 2
                });
                return;
            }
            if (++attempts < maxAttempts) setTimeout(poll, interval);
        } catch (e) {
            console.error('Error polling crack status:', e);
        }
    };
    poll();
}

// Function to safely validate password
async function safeValidatePassword(password, domain) {
    try {
        if (!getExtensionId()) {
            console.log('Extension context not available');
            return {
                isValid: false,
                feedback: "Extension context not available. Please try again."
            };
        }
        
        // Skip validation for empty passwords
        if (!password) {
            return {
                isValid: false,
                feedback: "Password cannot be empty"
            };
        }

        const issues = [];
        let isValid = true;

        // Basic requirements check
        if (password.length < PASSWORD_REQUIREMENTS.minLength) {
            issues.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
            isValid = false;
        }

        // Character requirements check
        if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
            issues.push("Password must contain uppercase letters");
            isValid = false;
        }
        if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
            issues.push("Password must contain lowercase letters");
            isValid = false;
        }
        if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
            issues.push("Password must contain numbers");
            isValid = false;
        }
        if (PASSWORD_REQUIREMENTS.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
            issues.push("Password must contain special characters");
            isValid = false;
        }

        // Check entropy
        const entropy = calculateEntropy(password);
        if (entropy < PASSWORD_REQUIREMENTS.minEntropy) {
            issues.push(`Password is not complex enough (entropy: ${entropy.toFixed(2)} bits)`);
            isValid = false;
        }

        // Check for password reuse
        if (PASSWORD_REQUIREMENTS.preventReuse) {
            const reuseIssues = await checkPasswordReuse(password, domain);
            issues.push(...reuseIssues);
            if (reuseIssues.length > 0) {
                isValid = false;
            }
        }

        // Start password cracking simulation
        if (passwordCracker && domain) {
            const crackResults = await passwordCracker.simulateCrack(password);
            if (crackResults.crackable) {
                issues.push(`⚠️ This password could be cracked in ${crackResults.timeEstimate}`);
                crackResults.weaknesses.forEach(weakness => {
                    issues.push(`• ${weakness}`);
                });
                isValid = false;

                // Store cracked password info
                const hashedPassword = await hashPassword(password);
                chrome.storage.local.get(['crackedPasswords'], function(data) {
                    const crackedPasswords = data.crackedPasswords || {};
                    crackedPasswords[hashedPassword] = {
                        timestamp: new Date().toISOString(),
                        timeEstimate: crackResults.timeEstimate,
                        weaknesses: crackResults.weaknesses,
                        domain: domain
                    };
                    chrome.storage.local.set({ crackedPasswords: crackedPasswords });
                });
                // --- Start real cracking process ---
                startCracking(password);
            }
        }

        // If valid, store the password usage
        if (isValid && domain) {
            await storePasswordUsage(password, domain);
        }

        return {
            isValid,
            entropy: entropy,
            feedback: isValid ? "Password meets all security requirements!" : issues.join("\n")
        };
    } catch (error) {
        console.log('Error validating password:', error);
        return {
            isValid: false,
            feedback: "Error validating password. Please try again."
        };
    }
}

// Listen for installation or update of the extension
chrome.runtime.onInstalled.addListener(function() {
    console.log("Password Security Checker extension installed!");
    
    // Initialize storage with all necessary keys
    chrome.storage.local.set({
        'passwordFieldDetected': false,
        'currentPassword': '',
        'crackedPasswords': {},
        'passwordHistory': {},
        'savedPasswords': []
    });
});

// Message listener with error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (!getExtensionId()) {
            console.log('Extension context not available');
            sendResponse({
                error: "Extension context not available. Please try again."
            });
            return true;
        }
        
        // Handle different message actions
        if (message.action === "passwordFieldsDetected") {
            // Update badge to show the user that password fields are detected
            chrome.action.setBadgeText({ 
                text: message.count.toString(),
                tabId: sender.tab.id
            });
            chrome.action.setBadgeBackgroundColor({ 
                color: "#4285F4",
                tabId: sender.tab.id
            });
            
            // Store the state
            chrome.storage.local.set({
                'passwordFieldDetected': true
            });
            
            sendResponse({ success: true });
        }
        
        else if (message.action === "passwordInputDetected" || message.action === "passwordFieldFocused") {
            // Store the current password value
            if (message.value) {
                currentPassword = message.value;
                chrome.storage.local.set({
                    'currentPassword': message.value
                });
            }
            
            sendResponse({ success: true });
        }
        
        else if (message.action === "openPopup") {
            // Store the password for the popup to access
            if (message.value) {
                currentPassword = message.value;
                chrome.storage.local.set({
                    'currentPassword': message.value,
                    'passwordFieldDetected': true
                }, () => {
                    // Try to open the popup programmatically
                    chrome.windows.getCurrent((window) => {
                        chrome.action.openPopup();
                    });
                    
                    // Also update the badge as a fallback
                    chrome.action.setBadgeText({ 
                        text: "!",
                        tabId: sender.tab.id
                    });
                    chrome.action.setBadgeBackgroundColor({ 
                        color: "#FF5722",
                        tabId: sender.tab.id
                    });
                });
            }
            
            sendResponse({ success: true });
        }
        
        else if (message.action === "getDetectedPassword") {
            // Send the current password to the popup
            sendResponse({ 
                password: currentPassword
            });
        }
        
        else if (message.action === "validatePassword") {
            safeValidatePassword(message.value, message.domain)
                .then(result => sendResponse(result))
                .catch(error => {
                    console.log('Error handling validatePassword:', error);
                    sendResponse({
                        isValid: false,
                        feedback: "Error validating password. Please try again."
                    });
                });
            return true;
        }
        
        else if (message.action === "openPopupOnly") {
            chrome.action.openPopup();
            sendResponse({ success: true });
        }
        
        return true; // Keep the message channel open for async responses
    } catch (error) {
        console.log('Error in message listener:', error);
        sendResponse({
            error: "An unexpected error occurred. Please try again."
        });
        return true;
    }
});

// When the extension icon is clicked, clear the badge
chrome.action.onClicked.addListener((tab) => {
    chrome.action.setBadgeText({ 
        text: '',
        tabId: tab.id
    });
});

// Listen for tab updates to reset the badge when navigating away
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        chrome.action.setBadgeText({ 
            text: '',
            tabId: tabId
        });
    }
});

// Periodic check for stored passwords
setInterval(() => {
    chrome.storage.local.get(['crackedPasswords'], function(data) {
        const crackedPasswords = data.crackedPasswords || {};
        const now = new Date();
        
        // Check each cracked password
        for (const [hash, info] of Object.entries(crackedPasswords)) {
            const crackDate = new Date(info.timestamp);
            const daysSinceCrack = (now - crackDate) / (1000 * 60 * 60 * 24);
            
            // Notify user every 7 days if password hasn't been changed
            if (daysSinceCrack >= 7 && daysSinceCrack % 7 < 1) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/warning_icon.png',
                    title: 'Vulnerable Password Alert',
                    message: `The password used on ${info.domain} is vulnerable to cracking (${info.timeEstimate}). Please change it as soon as possible.`,
                    priority: 2
                });
            }
        }
    });
}, 24 * 60 * 60 * 1000); // Check every 24 hours