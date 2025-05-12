// Elements in the popup
const passwordInput = document.getElementById('password-input');
const strengthLevel = document.getElementById('strength-level');
const strengthBar = document.getElementById('strength-level-bar');
const passwordFeedback = document.getElementById('password-feedback');
const detectedPasswordBanner = document.getElementById('detected-password-banner');
const checkDetectedPasswordButton = document.getElementById('check-detected-password');
const togglePasswordButton = document.getElementById('toggle-password');

// Variables to store detected password
let detectedPassword = '';

// Load the common passwords dataset
let commonPasswords = [];

// Function to load the dataset 
async function loadCommonPasswords() {
    try {
        const response = await fetch(chrome.runtime.getURL('data/common_passwords.csv'));
        const textData = await response.text();
        // Use PapaParse to parse the CSV text into an array of passwords and attributes
        Papa.parse(textData, {
            complete: function(results) {
                // Parse the CSV data and map it into a structured array
                commonPasswords = results.data.map(row => ({
                    password: row[0], // The actual password
                    length: parseInt(row[1]), 
                    numChars: parseInt(row[2]),
                    numDigits: parseInt(row[3]),
                    numUpper: parseInt(row[4]),
                    numLower: parseInt(row[5]),
                    numSpecial: parseInt(row[6]),
                    numVowels: parseInt(row[7]),
                    numSyllables: parseInt(row[8])
                }));
            },
            header: false // No header row in the CSV file
        });
    } catch (error) {
        console.error('Error loading common passwords:', error);
    }
}

// Call the function to load the dataset as soon as the extension loads
loadCommonPasswords();

// Function to calculate password entropy
function calculateEntropy(password) {
    let charset = 0;
    if (/[a-z]/.test(password)) charset += 26;  // lowercase
    if (/[A-Z]/.test(password)) charset += 26;  // uppercase
    if (/[0-9]/.test(password)) charset += 10;  // numbers
    if (/[^a-zA-Z0-9]/.test(password)) charset += 32;  // special characters
    
    const entropy = Math.log2(Math.pow(charset, password.length));
    return entropy;
}

// Function to get specific password improvement suggestions
function getPasswordSuggestions(password) {
    const suggestions = [];
    
    if (password.length < 12) {
        suggestions.push("Increase password length to at least 12 characters");
    }
    if (!/[A-Z]/.test(password)) {
        suggestions.push("Add uppercase letters");
    }
    if (!/[a-z]/.test(password)) {
        suggestions.push("Add lowercase letters");
    }
    if (!/\d/.test(password)) {
        suggestions.push("Add numbers");
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        suggestions.push("Add special characters");
    }
    if (/(.)\1{2,}/.test(password)) {
        suggestions.push("Avoid repeating characters");
    }
    if (/^[a-zA-Z0-9]+$/.test(password)) {
        suggestions.push("Mix different character types");
    }
    
    return suggestions;
}

// Function to display password reuse information
async function displayPasswordReuseInfo(password) {
    try {
        // Get the current tab's URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        const domain = new URL(currentTab.url).hostname;
        
        const response = await chrome.runtime.sendMessage({
            action: "validatePassword",
            value: password,
            domain: domain
        });
        
        if (response && response.feedback) {
            const reuseInfo = response.feedback.split('\n').filter(line => 
                line.includes('⚠️ Password was previously used on:') || 
                line.includes('⚠️ This password matches one stored in your password manager')
            );
            
            if (reuseInfo.length > 0) {
                let reuseMessage = "\n\n⚠️ PASSWORD REUSE DETECTED ⚠️";
                reuseMessage += "\n----------------------------------------";
                reuseInfo.forEach(info => {
                    const cleanInfo = info.replace('⚠️ ', '');
                    if (cleanInfo.includes('previously used on:')) {
                        const domains = cleanInfo.split(':')[1].trim();
                        reuseMessage += `\n\n🔴 This password was used on: ${domains}`;
                    } else if (cleanInfo.includes('password manager')) {
                        reuseMessage += `\n\n🔴 This password is stored in your password manager`;
                    }
                });
                reuseMessage += "\n----------------------------------------";
                reuseMessage += "\n⚠️ Using the same password on multiple sites is a security risk!";
                return reuseMessage;
            }
        }
    } catch (error) {
        console.error('Error checking password reuse:', error);
    }
    return "";
}

// Enhanced password strength checker
async function checkPasswordStrength(password) {
    let strength = 'Weak';
    let strengthColor = 'red';
    let strengthWidth = '33%';
    let feedbackText = "Password is too weak.";
    const entropy = calculateEntropy(password);
    const suggestions = getPasswordSuggestions(password);

    // Determine strength based on multiple factors
    if (password.length >= 12 && entropy >= 60) {
        if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            strength = 'Very Strong';
            strengthColor = '#00ff00';  // Bright green
            strengthWidth = '100%';
            feedbackText = "Excellent password! Very strong and secure.";
        } else {
            strength = 'Strong';
            strengthColor = '#90EE90';  // Light green
            strengthWidth = '80%';
            feedbackText = "Strong password, but could be improved.";
        }
    } else if (password.length >= 8 && entropy >= 40) {
        strength = 'Medium';
        strengthColor = 'orange';
        strengthWidth = '60%';
        feedbackText = "Medium strength password.";
    } else {
        strength = 'Weak';
        strengthColor = 'red';
        strengthWidth = '33%';
        feedbackText = "Weak password. Please improve it.";
    }

    // Add entropy information
    feedbackText += `\n\nPassword Entropy: ${entropy.toFixed(2)} bits`;
    
    // Add specific suggestions if any
    if (suggestions.length > 0) {
        feedbackText += "\n\nSuggestions to improve:";
        suggestions.forEach(suggestion => {
            feedbackText += `\n• ${suggestion}`;
        });
    }

    // Add password reuse information
    const reuseInfo = await displayPasswordReuseInfo(password);
    if (reuseInfo) {
        feedbackText += reuseInfo;
    }

    // Update the UI
    strengthLevel.textContent = strength;
    strengthLevel.style.color = strengthColor;
    strengthBar.style.width = strengthWidth;
    strengthBar.style.backgroundColor = strengthColor;
    passwordFeedback.textContent = feedbackText;

    return strength;
}

// Function to check if password exists in the common password list
function checkCommonPasswordsList(password) {
    // Find if the password exists in the commonPasswords array
    const foundPassword = commonPasswords.find(entry => entry.password === password);
    
    if (foundPassword) {
        // Provide enhanced feedback based on CSV data
        let feedback = "This password is too common. Try something more unique!";
        feedback += `\nLength: ${foundPassword.length} characters`;
        feedback += `\nContains ${foundPassword.numDigits} digits, ${foundPassword.numUpper} uppercase letters, and ${foundPassword.numSpecial} special characters.`;

        return feedback;
    }
    return "";
}

// Function to check if password was leaked using the Pwned Passwords API
async function checkPasswordLeak(password) {
    const hash = await sha1(password);
    const first5Chars = hash.slice(0, 5);
    const remainingChars = hash.slice(5).toUpperCase();
    
    try {
        const response = await fetch(`https://api.pwnedpasswords.com/range/${first5Chars}`);
        const data = await response.text();

        // The API returns a list of hash suffixes and breach counts
        const hashLines = data.split('\r\n');
        for (const line of hashLines) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix === remainingChars) {
                return `This password has been found in ${count} data breaches! Choose a different one.`;
            }
        }
    } catch (error) {
        console.error('Error checking password leak:', error);
    }
    return "";
}

// Toggle password visibility
togglePasswordButton.addEventListener('click', function() {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`;
    } else {
        passwordInput.type = 'password';
        this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
    }
});

// Function to check for detected password
async function checkForDetectedPassword() {
    // First check storage for detected password
    chrome.storage.local.get(['passwordFieldDetected', 'currentPassword'], function(data) {
        if (data.passwordFieldDetected && data.currentPassword) {
            detectedPassword = data.currentPassword;
            detectedPasswordBanner.style.display = 'block';
        }
    });
    
    // Also ask the background script directly
    chrome.runtime.sendMessage({
        action: "getDetectedPassword"
    }, response => {
        if (response && response.password) {
            detectedPassword = response.password;
            detectedPasswordBanner.style.display = 'block';
        }
    });
}

// Update Check Security button to request password from content script
checkDetectedPasswordButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getPagePassword"});
    });
});

// Listen for messages from content script and handle password autofill and evaluation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendPagePassword") {
        passwordInput.value = message.password || "";
        // Force the UI and listeners to update
        const inputEvent = new Event('input', { bubbles: true });
        passwordInput.dispatchEvent(inputEvent);
        if (message.password) {
            checkPasswordStrength(message.password).then(() => {
                const commonPasswordMessage = checkCommonPasswordsList(message.password);
                if (commonPasswordMessage) {
                    passwordFeedback.textContent = commonPasswordMessage;
                    strengthLevel.textContent = 'Very Weak';
                    strengthLevel.style.color = 'red';
                    strengthBar.style.width = '20%';
                    strengthBar.style.backgroundColor = 'red';
                } else {
                    checkPasswordLeak(message.password).then(leakMessage => {
                        if (leakMessage) {
                            passwordFeedback.textContent = leakMessage;
                        }
                    });
                }
            });
        }
    }
    if (message.action === "updatePopupPassword") {
        // Update the password input field
        passwordInput.value = message.password;
        
        // Automatically check the password
        checkPasswordStrength(message.password).then(() => {
            // Check if the password exists in the common passwords list
            const commonPasswordMessage = checkCommonPasswordsList(message.password);
            if (commonPasswordMessage) {
                passwordFeedback.textContent = commonPasswordMessage;
                strengthLevel.textContent = 'Very Weak';
                strengthLevel.style.color = 'red';
                strengthBar.style.width = '20%';
                strengthBar.style.backgroundColor = 'red';
            } else {
                // Check if password was leaked
                checkPasswordLeak(message.password).then(leakMessage => {
                    if (leakMessage) {
                        passwordFeedback.textContent = leakMessage;
                    }
                });
            }
        });
    }
    return true;
});

// Function to hash the password using SHA-1 (for Pwned Passwords API)
async function sha1(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex.toUpperCase();
}

// Run when the popup is opened
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(['popupPassword'], function(data) {
        if (data.popupPassword) {
            passwordInput.value = data.popupPassword;
            // Trigger input event for evaluation
            const inputEvent = new Event('input', { bubbles: true });
            passwordInput.dispatchEvent(inputEvent);
            // Fallback: directly call the evaluation function
            checkPasswordStrength(data.popupPassword);
            // Clear the stored password
            chrome.storage.local.remove('popupPassword');
        }
    });
    checkForDetectedPassword();
});

const ensiaLogoUrl = chrome.runtime.getURL('icons/EnsiaLogo.png');

passwordInput.addEventListener('input', async function() {
    const password = passwordInput.value;
    if (!password) return;
    await checkPasswordStrength(password);
});