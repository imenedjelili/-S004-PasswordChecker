// Password cracking simulation system
export class PasswordCracker {
    constructor() {
        this.commonPatterns = [
            /^[A-Z][a-z]+\d{2,4}$/,  // Capital letter, lowercase, 2-4 numbers
            /^[a-z]+\d{2,4}!?$/,      // Lowercase letters, 2-4 numbers, optional !
            /^[A-Z][a-z]+\d{1,2}[!@#$%^&*]$/,  // Capital, lowercase, 1-2 numbers, special char
            /^\d{2,4}[A-Za-z]+\d{2,4}$/  // 2-4 numbers, letters, 2-4 numbers
        ];

        this.commonSubstitutions = {
            'a': ['@', '4'],
            'e': ['3'],
            'i': ['1', '!'],
            'o': ['0'],
            's': ['$', '5'],
            't': ['7'],
            'b': ['8'],
            'g': ['9'],
            'l': ['1'],
        };

        this.commonWords = [
            'password', 'letmein', 'welcome', 'admin', 'monkey',
            'dragon', 'master', 'hello', 'love', 'abc123'
        ];

        // Load additional word lists
        this.loadWordlists();
    }

    async loadWordlists() {
        try {
            // Load common password lists
            const response = await fetch(chrome.runtime.getURL('data/common_passwords.csv'));
            const text = await response.text();
            const passwords = text.split('\n').map(line => line.split(',')[0]);
            this.commonWords = [...new Set([...this.commonWords, ...passwords])];
        } catch (error) {
            console.error('Error loading wordlists:', error);
        }
    }

    // Test if password follows common patterns
    testPatterns(password) {
        return this.commonPatterns.some(pattern => pattern.test(password));
    }

    // Test common character substitutions
    testSubstitutions(password) {
        const lowerPassword = password.toLowerCase();
        
        // Generate possible original passwords by reversing substitutions
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
        
        // Check if any of the possible original passwords are common
        return possibleOriginals.some(pwd => this.commonWords.includes(pwd));
    }

    // Test for keyboard patterns
    testKeyboardPatterns(password) {
        const keyboardRows = [
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];

        const lowerPassword = password.toLowerCase();
        
        // Check for straight line patterns
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
    }

    // Test for date patterns
    testDatePatterns(password) {
        // Common date formats
        const datePatterns = [
            /\d{4}$/,              // Year at end
            /\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/, // YYMMDD
            /(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{2,4}/, // MMDDYY(YY)
            /^(19|20)\d{2}/ // Year at start
        ];

        return datePatterns.some(pattern => pattern.test(password));
    }

    // Estimate time to crack
    estimateCrackingTime(password) {
        // Base calculation on password complexity and length
        let possibleChars = 0;
        if (/[a-z]/.test(password)) possibleChars += 26;
        if (/[A-Z]/.test(password)) possibleChars += 26;
        if (/\d/.test(password)) possibleChars += 10;
        if (/[^a-zA-Z0-9]/.test(password)) possibleChars += 32;

        // Calculate combinations
        const combinations = Math.pow(possibleChars, password.length);
        
        // Assume modern cracking speed (100 billion attempts per second)
        const attemptsPerSecond = 100000000000;
        
        // Calculate time in seconds
        const seconds = combinations / attemptsPerSecond;
        
        // Convert to human-readable format
        if (seconds < 60) return `${Math.round(seconds)} seconds`;
        if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
        if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
        return `${Math.round(seconds / 31536000)} years`;
    }

    // Main cracking simulation function
    async simulateCrack(password) {
        const results = {
            crackable: false,
            method: null,
            timeEstimate: this.estimateCrackingTime(password),
            weaknesses: []
        };

        // Test for common patterns
        if (this.testPatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Uses common password pattern');
            results.method = 'pattern';
        }

        // Test for substitutions
        if (this.testSubstitutions(password)) {
            results.crackable = true;
            results.weaknesses.push('Uses common character substitutions');
            results.method = 'substitution';
        }

        // Test for keyboard patterns
        if (this.testKeyboardPatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Contains keyboard pattern');
            results.method = 'keyboard';
        }

        // Test for date patterns
        if (this.testDatePatterns(password)) {
            results.crackable = true;
            results.weaknesses.push('Contains date pattern');
            results.method = 'date';
        }

        // Check if password is too short
        if (password.length < 12) {
            results.crackable = true;
            results.weaknesses.push('Password is too short');
            results.method = 'brute-force';
        }

        return results;
    }

    // Start background cracking attempt
    async startCrackingAttempt(password, tabId) {
        const results = await this.simulateCrack(password);
        
        if (results.crackable) {
            // Send notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/warning_icon.png',
                title: 'Password Vulnerability Detected',
                message: `Your password could be cracked in ${results.timeEstimate}. Weaknesses: ${results.weaknesses.join(', ')}`,
                priority: 2
            });

            // Send message to content script
            chrome.tabs.sendMessage(tabId, {
                action: 'passwordCracked',
                results: results
            });
        }

        return results;
    }
} 