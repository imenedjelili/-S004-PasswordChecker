# CNS-Project---Secondary
# 🔐 Password Security Checker Extension

A real-time Chrome extension that evaluates password strength, detects compromised credentials, and educates users on password security.

![Badge](https://img.shields.io/badge/version-1.0-blue.svg)  
![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-yellow)  
![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-red)

---

## 📌 Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Testing](#testing)
- [Limitations](#limitations)
- [Future Work](#future-work)
- [Resources](#resources)
- [Contributors](#contributors)
- [Links](#links)

---

## 🧠 About

**Password Security Checker** is a Chrome extension developed to improve user awareness around password security. It gives instant feedback about password strength and notifies users if their password has been found in a data breach.

This extension aims to enhance security hygiene and reduce vulnerabilities arising from poor password practices.

---

## ✨ Features

- ✅ Detects password fields automatically on any webpage.
- ✅ Analyzes password strength using:
  - Length
  - Character variety (upper/lowercase, digits, symbols)
  - Entropy & randomness
  - Common phrases or syllables
- ✅ Integrates with the [Have I Been Pwned](https://haveibeenpwned.com/) API to check for compromised passwords.
- ✅ Provides actionable security tips and guidance.
- ✅ User-friendly popup interface with a strength meter and warnings.
- ✅ Lightweight and efficient, with minimal browser impact.

---

## 🛠️ Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/imenedjelili/CNS-Project---Secondary.git
   ```

2. Open Google Chrome and go to `chrome://extensions/`.

3. Enable **Developer Mode** (top right corner).

4. Click **Load unpacked** and select the project folder.

5. The extension icon should now appear in your browser toolbar!

---

## 🚀 Usage

- Visit any website with a password field.
- Enter a password — you'll get real-time strength feedback.
- Click the extension icon to open a popup with detailed analysis, warnings, and suggestions.

---

## ✅ Testing

### Functional Tests
- Verified detection of password fields on dynamic websites.
- Assessed passwords of varying strength and confirmed accurate feedback.
- Breach detection successfully triggered via the Have I Been Pwned API.

### Edge Case Tests
- Handled empty and extremely long inputs gracefully.
- Managed network/API failures with fallback messages.
- Worked on pages with multiple or dynamically loaded password fields.

---

## ⚠️ Limitations

- Requires internet connection for breach detection.
- Currently available only for Google Chrome.
- No integration with third-party password managers.
- Does not support custom strength rules or configurations.

---

## 🌱 Future Work

- Cross-browser support (Firefox, Edge, Brave)
- Offline breach detection using local datasets
- Machine learning-based strength predictions
- Customizable password policies
- Integration with password managers
- User education tutorials and gamified training

---

## 📚 Resources

- [Have I Been Pwned API](https://haveibeenpwned.com/API/v3)
- [OWASP Password Guidelines](https://owasp.org/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Mozilla Password Best Practices](https://infosec.mozilla.org/guidelines/passwords)

---

## 👩‍💻 Contributors

- **Imene Fatma DJELILI** - [fatma.imene.djelili@ensia.edu.dz](mailto:fatma.imene.djelili@ensia.edu.dz)  
- **Hadil HATTABI** - [hadil.hattabi@ensia.edu.dz](mailto:hadil.hattabi@ensia.edu.dz)  
- **Firdaws BASSAID** - [firdaws.bassaid@ensia.edu.dz](mailto:firdaws.bassaid@ensia.edu.dz)  
- **Hachem Safi Eddine SEKHSOUKH** - [hachem.safi.eddine.sekhsoukh@ensia.edu.dz](mailto:hachem.safi.eddine.sekhsoukh@ensia.edu.dz)  
- **Youcef GUERGOUR** - [youcef.guergour@ensia.edu.dz](mailto:youcef.guergour@ensia.edu.dz)  
- **Rafik MESSAOUD NACER** - [rafik.messaoud.nacer@ensia.edu.dz](mailto:rafik.messaoud.nacer@ensia.edu.dz)

---

## 🔗 Links

- **GitHub Repository**: [https://github.com/imenedjelili/CNS-Project---Secondary](https://github.com/imenedjelili/CNS-Project---Secondary)
- **Demo Video**: [https://demoLink](https://demoLink)

---

Let me know if you'd like me to help you include images or create a badge or GitHub Actions workflow for testing and deployment!