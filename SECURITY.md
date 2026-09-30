# Security

Please do not open public issues for suspected vulnerabilities.

Use GitHub's **Report a vulnerability** flow for this repository. Private vulnerability reporting is enabled so reports can be discussed with the maintainer without disclosing details publicly.

MatrixTrim reads GitHub Actions metadata and, for failed jobs, logs. Runtime matrix evidence can also be stored in Check Run annotations when capture mode is explicitly enabled. Do not place secrets in matrix values, reports, fixtures, or captured evidence.

Repository security controls include secret scanning with push protection, Dependabot vulnerability alerts and security updates, dependency review, CodeQL default setup, SHA-pinned workflow dependencies, and immutable exact releases.
