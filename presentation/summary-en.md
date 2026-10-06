# Qalqan Finance Security
## Project summary · Cybersecurity

Qalqan is a research prototype for detecting signs of financial phishing in SMS, WhatsApp messages, emails, and URLs. It targets bank customers, students, and frontline support staff. Messages impersonating a bank can pressure users into sharing verification codes, card details, or transferring money to a purported safe account.

The user submits a message, conversation, or URL. The current web form applies local browser rules and returns a 0–100 risk index, highlighted indicators, and advice in Russian or Kazakh. The index is not a calibrated fraud probability; a low score does not guarantee safety. Indicators include secret requests, urgency, account-blocking threats, rewards, suspicious transfers, and bank-domain impersonation.

The web demo includes in-tab history, a dashboard, and browser-based PDF printing; message text remains in tab memory. A separate server API combines explainable rules with a character TF-IDF and Logistic Regression baseline for research and compatibility, but the current analysis form does not call it. URLs are never opened. Domain age, WHOIS, and reputation are outside the current implementation.

On 42 authored synthetic test rows from 14 templates, the current browser rules caught 18 of 21 scam examples, missed 3, and raised no alerts on 21 ordinary examples: precision 1.000 and recall 0.857. All three misses were in Russian examples. The separate server hybrid with ML achieved precision 0.875 and recall 1.000 on the same corpus. Variants are correlated and the test was used during development; these figures do not establish real-world performance. A new external blind test is required.

The next step is permitted anonymized data, independent annotation, language-level evaluation, and a controlled operator-assisted pilot. Readiness is a laboratory MVP, approximately self-assessed TRL 4, without verified bank deployment.

Repository: https://github.com/birliktuzdyermek-tech/Finance2

University: Almaty Technological University. Team (original spelling): Бірліктұзды Ермек Жақсыбекұлы; Валентинов Ерасыл Оралсеийтович. Roles, supervisor and contact: complete before submission. Demo URL: https://qalqan-finance2.onrender.com. Video: [record and attach before submission].
