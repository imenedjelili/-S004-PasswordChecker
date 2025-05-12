// This content script runs on web pages to detect password fields
// and communicate with the extension

// Store password validation states
const passwordValidationStates = new Map();

// Password cracker implementation
const passwordCracker = {
    commonPatterns: [
        /^[A-Z][a-z]+\d{2,4}$/,  // Capital letter, lowercase, 2-4 numbers
        /^[a-z]+\d{2,4}!?$/,      // Lowercase letters, 2-4 numbers, optional !
        /^[A-Z][a-z]+\d{1,2}[!@#$%^&*]$/,  // Capital, lowercase, 1-2 numbers, special char
        /^\d{2,4}[A-Za-z]+\d{2,4}$/  // 2-4 numbers, letters, 2-4 numbers
    ],

    commonSubstitutions: {
        'a': ['@', '4'],
        'e': ['3'],
        'i': ['1', '!'],
        'o': ['0'],
        's': ['$', '5'],
        't': ['7'],
        'b': ['8'],
        'g': ['9'],
        'l': ['1']
    },

    // Test if password follows common patterns
    testPatterns(password) {
        return this.commonPatterns.some(pattern => pattern.test(password));
    },

    // Test common character substitutions
    testSubstitutions(password) {
        const lowerPassword = password.toLowerCase();
        let possibleOriginals = [lowerPassword];
        
        for (const [letter, substitutes] of Object.entries(this.commonSubstitutions)) {
            const newPossibilities = [];
            for (const current of possibleOriginals) {
                for (const sub of substitutes) {
                    if (current.includes(sub)) {
                        newPossibilities.push(current.replaceAll(sub, letter));
                    }
                }
            }
            possibleOriginals = [...possibleOriginals, ...newPossibilities];
        }
        return false; // Simplified for now
    },

    // Test for keyboard patterns
    testKeyboardPatterns(password) {
        const keyboardRows = [
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];

        const lowerPassword = password.toLowerCase();
        
        for (const row of keyboardRows) {
            for (let i = 0; i < row.length - 3; i++) {
                const pattern = row.slice(i, i + 4);
                if (lowerPassword.includes(pattern) || 
                    lowerPassword.includes(pattern.split('').reverse().join(''))) {
                    return true;
                }
            }
        }
        return false;
    },

    // Test for date patterns
    testDatePatterns(password) {
        const datePatterns = [
            /\d{4}$/,              // Year at end
            /\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/, // YYMMDD
            /(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{2,4}/, // MMDDYY(YY)
            /^(19|20)\d{2}/ // Year at start
        ];
        return datePatterns.some(pattern => pattern.test(password));
    },

    // Estimate time to crack
    estimateCrackingTime(password) {
        let possibleChars = 0;
        if (/[a-z]/.test(password)) possibleChars += 26;
        if (/[A-Z]/.test(password)) possibleChars += 26;
        if (/\d/.test(password)) possibleChars += 10;
        if (/[^a-zA-Z0-9]/.test(password)) possibleChars += 32;

        const combinations = Math.pow(possibleChars, password.length);
        const attemptsPerSecond = 100000000000;
        const seconds = combinations / attemptsPerSecond;
        
        if (seconds < 60) return `${Math.round(seconds)} seconds`;
        if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
        if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
        return `${Math.round(seconds / 31536000)} years`;
    },

    // Main cracking simulation function
    simulateCrack(password) {
        const results = {
            crackable: false,
            method: null,
            timeEstimate: this.estimateCrackingTime(password),
            weaknesses: []
        };

        if (this.testPatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Uses common password pattern');
            results.method = 'pattern';
        }

        if (this.testSubstitutions(password)) {
            results.crackable = true;
            results.weaknesses.push('Uses common character substitutions');
            results.method = 'substitution';
        }

        if (this.testKeyboardPatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Contains keyboard pattern');
            results.method = 'keyboard';
        }

        if (this.testDatePatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Contains date pattern');
            results.method = 'date';
        }

        if (password.length < 12) {
            results.crackable = true;
            results.weaknesses.push('Password is too short');
            results.method = 'brute-force';
        }

        return results;
    }
};

// Function to check password strength locally (quick check)
function quickPasswordCheck(password) {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength &&
           hasUpperCase &&
           hasLowerCase &&
           hasNumbers &&
           hasSpecialChars;
}

// Function to get current domain
function getCurrentDomain() {
    return window.location.hostname;
}

// Function to get friendly time format
function getFriendlyTimeEstimate(seconds) {
    if (seconds < 60) return "less than a minute";
    if (seconds < 3600) return `about ${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `about ${Math.round(seconds / 3600)} hours`;
    if (seconds < 31536000) return `about ${Math.round(seconds / 86400)} days`;
    const years = Math.round(seconds / 31536000);
    return years > 1000000 ? "millions of years" : `about ${years} years`;
}

// Function to get friendly feedback message
function getFriendlyFeedback(results) {
    let message = "";
    
    if (results.crackable) {
        message = "🔒 Your password could be stronger! Here's why:\n\n";
        
        results.weaknesses.forEach(weakness => {
            switch(weakness) {
                case "Password is too short":
                    message += "• Try making your password longer (at least 12 characters)\n";
                    break;
                case "Uses common password pattern":
                    message += "• Your password follows a common pattern that's easy to guess\n";
                    break;
                case "Uses common character substitutions":
                    message += "• Using @ for 'a' or 1 for 'i' is a known trick - try something more creative!\n";
                    break;
                case "Contains keyboard pattern":
                    message += "• Avoid using keyboard patterns like 'qwerty' or '12345'\n";
                    break;
                case "Contains date pattern":
                    message += "• Using dates (like birthdays) makes your password easier to guess\n";
                    break;
                default:
                    message += `• ${weakness}\n`;
            }
        });
        
        message += "\n💡 Time to crack: " + results.timeEstimate;
        message += "\n\nTip: Mix random words with numbers and symbols for a stronger password!";
    } else {
        message = "🎉 Great password! Here's why:\n\n";
        message += "• Good length\n";
        message += "• Nice mix of characters\n";
        message += "• No common patterns\n\n";
        message += "💪 Time to crack: " + results.timeEstimate;
    }
    
    return message;
}

// Function to get entropy explanation
function getEntropyExplanation(entropy) {
    let explanation = "";
    if (entropy < 40) {
        explanation = "(This is a weak password that could be guessed quickly)";
    } else if (entropy < 64) {
        explanation = "(This is a moderate password that provides basic security)";
    } else if (entropy < 80) {
        explanation = "(This is a good password with decent protection)";
    } else if (entropy < 100) {
        explanation = "(This is a very good password that would take significant time to crack)";
    } else {
        explanation = "(This is an excellent password that would take an extremely long time to crack)";
    }
    return explanation;
}

// Function to safely send message to extension
async function safeSendMessage(message) {
    try {
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            console.log('Extension context not available');
            return null;
        }
        
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    console.log('Message sending error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.log('Error sending message:', error);
        return null;
    }
}

// Function to validate password with the extension
async function validatePasswordWithExtension(password, field) {
    try {
        const response = await safeSendMessage({
            action: "validatePassword",
            value: password,
            domain: getCurrentDomain()
        });

        if (response) {
            if (response.isValid) {
                passwordValidationStates.set(field, true);
                const feedback = (response.feedback || "Password is strong!") + 
                               (response.entropy ? getEntropyExplanation(response.entropy) : "");
                updatePasswordFieldStatus(field, true, feedback);
                return true;
            } else {
                passwordValidationStates.set(field, false);
                const feedback = (response.feedback || "Password is too weak!") + 
                               (response.entropy ? getEntropyExplanation(response.entropy) : "");
                updatePasswordFieldStatus(field, false, feedback);
                return false;
            }
        }
    } catch (error) {
        console.log('Password validation error:', error);
        updatePasswordFieldStatus(field, false, "Error checking password. Please try again.");
    }
    return false;
}

// Function to update password field visual status
function updatePasswordFieldStatus(field, isValid, message) {
    // Remove any existing status elements
    const existingStatus = field.parentElement.querySelector('.password-status-indicator');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Store original styles
    const originalStyles = {
        border: field.style.border,
        boxSizing: field.style.boxSizing,
        padding: field.style.padding
    };

    // Create status container
    const statusContainer = document.createElement('div');
    statusContainer.className = 'password-status-container';
    statusContainer.style.position = 'absolute';
    statusContainer.style.right = '30px';
    statusContainer.style.top = '50%';
    statusContainer.style.transform = 'translateY(-50%)';
    statusContainer.style.display = 'flex';
    statusContainer.style.alignItems = 'center';
    statusContainer.style.gap = '5px';
    statusContainer.style.zIndex = '1000';

    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'password-status-indicator';
    statusIndicator.style.fontSize = '14px';
    statusIndicator.style.cursor = 'help';

    // Add icon
    const icon = document.createElement('span');
    icon.textContent = isValid ? '✓' : '✗';
    icon.style.color = isValid ? '#4CAF50' : '#F44336';
    statusIndicator.appendChild(icon);

    // Create detailed feedback popup
    const feedbackPopup = document.createElement('div');
    feedbackPopup.className = 'password-feedback-popup';
    feedbackPopup.style.position = 'absolute';
    feedbackPopup.style.right = '100%';
    feedbackPopup.style.top = '50%';
    feedbackPopup.style.transform = 'translateY(-50%)';
    feedbackPopup.style.backgroundColor = 'white';
    feedbackPopup.style.padding = '10px';
    feedbackPopup.style.borderRadius = '4px';
    feedbackPopup.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    feedbackPopup.style.marginRight = '10px';
    feedbackPopup.style.zIndex = '10000';
    feedbackPopup.style.display = 'none';
    feedbackPopup.style.width = '250px';
    feedbackPopup.style.whiteSpace = 'pre-wrap';

    // Format the feedback message
    const formattedMessage = message.split('\n').map(line => {
        if (line.startsWith('•')) {
            return `<li>${line.substring(1).trim()}</li>`;
        }
        return `<p>${line}</p>`;
    }).join('');

    feedbackPopup.innerHTML = formattedMessage;

    // Show/hide popup on hover
    statusIndicator.addEventListener('mouseenter', () => {
        feedbackPopup.style.display = 'block';
    });
    statusIndicator.addEventListener('mouseleave', () => {
        feedbackPopup.style.display = 'none';
    });

    // Add elements to the DOM
    statusContainer.appendChild(statusIndicator);
    statusContainer.appendChild(feedbackPopup);

    // Ensure parent has relative positioning
    if (getComputedStyle(field.parentElement).position === 'static') {
        field.parentElement.style.position = 'relative';
    }

    // Add status container to the field
    field.parentElement.appendChild(statusContainer);

    // Update field style with box-sizing
    field.style.boxSizing = 'border-box';
    field.style.border = `1px solid ${isValid ? '#4CAF50' : '#F44336'}`;
    field.style.paddingRight = '50px';

    // Add cleanup function
    field.addEventListener('blur', () => {
        // Restore original styles when field loses focus
        field.style.border = originalStyles.border;
        field.style.boxSizing = originalStyles.boxSizing;
        field.style.padding = originalStyles.padding;
    });
}

// Function to show a notification near the password field
function showPasswordCheckerNotification(passwordField) {
    // Remove any existing notification
    const existingNotification = document.getElementById('password-checker-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'password-checker-notification';
    notification.style.cssText = `
        position: absolute;
        padding: 12px;
        background-color: white;
        border: 2px solid #4285F4;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        z-index: 2147483647;
        font-size: 14px;
        min-width: 250px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    `;
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    `;
    
    // Add ENSIA logo
    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('icons/EnsiaLogo.png');
    logo.style.cssText = `
        width: 24px;
        height: 24px;
        margin-right: 8px;
        object-fit: contain;
    `;
    messageContainer.appendChild(logo);
    
    // Add message text
    const messageText = document.createElement('div');
    messageText.textContent = 'Check your password strength with Password Security Checker';
    messageText.style.color = '#333';
    messageContainer.appendChild(messageText);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: center;
        margin-top: 8px;
    `;
    
    // Create check button
    const checkButton = document.createElement('button');
    checkButton.textContent = 'Check Password Security';
    checkButton.style.cssText = `
        background-color: #4285F4;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
        width: 100%;
    `;
    
    // Add hover effect
    checkButton.addEventListener('mouseover', () => {
        checkButton.style.backgroundColor = '#3367d6';
    });
    checkButton.addEventListener('mouseout', () => {
        checkButton.style.backgroundColor = '#4285F4';
    });
    
    // Add click handler for the notification's check button
    checkButton.addEventListener('click', () => {
        const password = passwordField.value;
        chrome.storage.local.set({ popupPassword: password }, () => {
            chrome.runtime.sendMessage({ action: "openPopupOnly" });
        });
    });
    
    // Assemble the notification
    buttonContainer.appendChild(checkButton);
    notification.appendChild(messageContainer);
    notification.appendChild(buttonContainer);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Position the notification near the password field
    const fieldRect = passwordField.getBoundingClientRect();
    const notificationRect = notification.getBoundingClientRect();
    
    // Calculate position
    let top = fieldRect.bottom + window.scrollY + 5;
    let left = fieldRect.left + window.scrollX;
    
    // Adjust position if it would go off-screen
    if (left + notificationRect.width > window.innerWidth) {
        left = window.innerWidth - notificationRect.width - 10;
    }
    
    notification.style.top = `${top}px`;
    notification.style.left = `${left}px`;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide notification when clicking outside
    function hideNotification(e) {
        if (e.target !== notification && 
            !notification.contains(e.target) && 
            e.target !== passwordField) {
            notification.style.display = 'none';
            document.removeEventListener('click', hideNotification);
        }
    }
    
    // Add click listener with a slight delay to prevent immediate hiding
    setTimeout(() => {
        document.addEventListener('click', hideNotification);
    }, 100);
    
    return notification;
}

// Add debounce function at the top level
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to detect password fields
function detectPasswordFields() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    if (passwordFields.length > 0) {
        // Notify the extension that password fields exist
        safeSendMessage({
            action: "passwordFieldsDetected",
            count: passwordFields.length
        });
        
        // Process each password field
        passwordFields.forEach(field => {
            // Ensure parent element exists and has relative positioning
            if (!field.parentElement) {
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                field.parentNode.insertBefore(wrapper, field);
                wrapper.appendChild(field);
            }

            // Show notification when field is focused
            field.addEventListener('focus', () => {
                showPasswordCheckerNotification(field);
            });

            // Add input event listener to send password to popup
            field.addEventListener('input', () => {
                const password = field.value;
                if (password) {
                    // Send password to popup
                    chrome.runtime.sendMessage({
                        action: "updatePopupPassword",
                        password: password
                    });
                }
            });

            // Find the form containing this password field
            const form = field.closest('form');
            if (form && !form.hasPasswordValidator) {
                form.hasPasswordValidator = true;
                
                // Add form submission handler
                form.addEventListener('submit', async (e) => {
                    // Prevent form submission initially
                    e.preventDefault();
                    
                    // Find all password fields in this form
                    const formPasswordFields = form.querySelectorAll('input[type="password"]');
                    let allPasswordsValid = true;
                    
                    // Validate all password fields
                    for (const passwordField of formPasswordFields) {
                        const password = passwordField.value;
                        
                        // Skip empty password fields (might be optional)
                        if (!password) continue;
                        
                        // Check if we already validated this password
                        if (!passwordValidationStates.get(passwordField)) {
                            // Quick check first
                            if (!quickPasswordCheck(password)) {
                                allPasswordsValid = false;
                                updatePasswordFieldStatus(passwordField, false, "Password doesn't meet minimum requirements");
                                continue;
                            }
                            
                            // Thorough check with extension
                            const isValid = await validatePasswordWithExtension(password, passwordField);
                            if (!isValid) {
                                allPasswordsValid = false;
                            }
                        } else if (!passwordValidationStates.get(passwordField)) {
                            allPasswordsValid = false;
                        }
                    }
                    
                    if (!allPasswordsValid) {
                        // Show error message
                        const errorMessage = document.createElement('div');
                        errorMessage.style.color = '#F44336';
                        errorMessage.style.marginTop = '10px';
                        errorMessage.style.fontSize = '14px';
                        errorMessage.textContent = 'Please ensure all passwords meet the security requirements.';
                        
                        // Remove any existing error messages
                        const existingError = form.querySelector('.password-error-message');
                        if (existingError) {
                            existingError.remove();
                        }
                        
                        errorMessage.className = 'password-error-message';
                        form.appendChild(errorMessage);
                        
                        // Scroll to the first invalid password field
                        const firstInvalidField = Array.from(formPasswordFields).find(field => !passwordValidationStates.get(field));
                        if (firstInvalidField) {
                            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            firstInvalidField.focus();
                        }
                    } else {
                        // All passwords are valid, submit the form
                        form.submit();
                    }
                });
            }
        });
    }
}

// Function to find the nearest password field to a button
function findNearestPasswordField(button) {
    // First check if the button is inside a form
    const form = button.closest('form');
    if (form) {
        return form.querySelector('input[type="password"]');
    }
    
    // If not in a form, find all password fields and get the closest one
    const allPasswordFields = Array.from(document.querySelectorAll('input[type="password"]'));
    if (allPasswordFields.length === 1) {
        return allPasswordFields[0];
    }
    
    // If multiple password fields, find the closest one
    let closestField = null;
    let closestDistance = Infinity;
    const buttonRect = button.getBoundingClientRect();
    
    allPasswordFields.forEach(field => {
        const fieldRect = field.getBoundingClientRect();
        const distance = Math.hypot(
            buttonRect.left - fieldRect.left,
            buttonRect.top - fieldRect.top
        );
        if (distance < closestDistance) {
            closestDistance = distance;
            closestField = field;
        }
    });
    
    return closestField;
}

// Run the detection immediately and when the page loads
detectPasswordFields();

window.addEventListener('load', () => {
    detectPasswordFields();
    
    // Add mutation observer to detect dynamically added password fields
    const observer = new MutationObserver(() => {
        detectPasswordFields();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'passwordCracked') {
        const passwordField = document.querySelector('input[type="password"]');
        if (passwordField) {
            let feedback = message.results.weaknesses.join('\n');
            
            // Add entropy explanation if entropy is present
            if (message.results.entropy !== undefined) {
                feedback += `\n\nPassword Entropy: ${message.results.entropy.toFixed(2)} bits\n`;
                feedback += getEntropyExplanation(message.results.entropy);
            }
            
            updatePasswordFieldStatus(passwordField, false, feedback);
        }
    }
    return true;
});

// Listen for messages from the popup to provide the password field value
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getPagePassword") {
        const passwordField = document.querySelector('input[type="password"]');
        const password = passwordField ? passwordField.value : "";
        chrome.runtime.sendMessage({action: "sendPagePassword", password});
    }
    return true;
});