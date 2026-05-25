# Contributing to Autocorrect Tool

Thank you for your interest in contributing! This guide will help you get started.

## Project Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | FastAPI server with 3-tier NLP pipeline |
| `frontend/` | React + Vite + Slate.js editor UI |
| `extension/` | Chrome MV3 browser extension |

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/autocorrect_tool.git
   cd "autocorrect tool"
   ```
3. **Set up** the development environment (see [README.md](README.md))

## Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes. For the **backend**, run tests before committing:
   ```bash
   cd backend
   python -m pytest tests/ -v
   ```

3. For the **frontend**, verify the build passes:
   ```bash
   cd frontend
   npm run build
   ```

4. For the **extension**, verify the build passes:
   ```bash
   cd extension
   npm run build
   ```

## Code Style

### Backend (Python)
- Formatting: [`ruff format`](https://docs.astral.sh/ruff/)
- Linting: `ruff check .`
- Type hints are required for all public functions

### Frontend (JavaScript)
- ESLint is configured — run `npm run lint`
- Use functional components with hooks
- All new components should be in `src/components/<ComponentName>/`

## Adding Tests

- Backend: add pytest tests in `backend/tests/`
- Name test files `test_<module>.py`
- Mock the NLP pipeline in API tests (see `test_api.py` for examples)

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update tests if you change behavior
- Update the README if you add or change API endpoints or configuration variables
- Use a clear, descriptive PR title

## Reporting Issues

Open a [GitHub issue](https://github.com/mimanshugahlaut/autocorrect_tool/issues) with:
- A clear description of the problem
- Steps to reproduce
- Your OS, Python version, Node.js version
- Any relevant error messages or logs

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
