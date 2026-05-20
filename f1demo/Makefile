PYVENV := ./.venv/bin

.PHONY: test backend start-backend ci

test:
	$(PYVENV)/python -m pytest -q backend/tests

backend:
	$(PYVENV)/python -m uvicorn backend.main:app --reload

start-backend: backend

ci: test
