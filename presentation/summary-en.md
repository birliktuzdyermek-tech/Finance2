# Qalqan Finance Security
## Project summary · Cybersecurity

Qalqan is a research prototype for detecting signs of financial phishing in SMS, WhatsApp messages, emails, and URLs. It targets bank customers, students, and frontline support staff. Messages impersonating a bank can pressure users into sharing verification codes, card details, or transferring money to a purported safe account.

The user submits a message or URL and receives a 0–100 risk index, detected indicators, and an action recommendation. The index is not a calibrated fraud probability; a low score does not guarantee safety. Indicators include secret requests, urgency, account-blocking threats, rewards, suspicious transfers, and bank-domain impersonation.

The MVP combines explainable rules with a character TF-IDF and Logistic Regression baseline. It includes a responsive interface, FastAPI, session-isolated history, a threat dashboard, PDF reports, and PostgreSQL deployment configuration. URLs are never opened and original messages are not retained. Domain age, WHOIS, and reputation are outside the current implementation.

The reproducible experiment uses 132 authored synthetic Russian, Kazakh, and English examples from 44 templates. Training contains 30 templates; testing contains 14 without group overlap. On 42 correlated test rows, the hybrid method achieved precision 0.875, recall 1.000, F1 0.933, and false positive rate 0.143. Rules outperform ML on this simple benchmark. These results do not establish real-world banking performance. The test was used during development; a new external blind test is required.

The next step is permitted anonymized data, independent annotation, language-level evaluation, and a controlled operator-assisted pilot. Readiness is a laboratory MVP, approximately self-assessed TRL 4, without verified bank deployment.

Repository: https://github.com/birliktuzdyermek-tech/Finance2

University: Almaty Technological University. Team (original spelling): Бірліктұзды Ермек Жақсыбекұлы; Валентинов Ерасыл Оралсеийтович. Roles, supervisor and contact: complete before submission. Add the public demo URL and video after publication.
