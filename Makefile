.PHONY: run dev stop restart destroy destroy-data logs status db-shell db-backup

# Production: tailscale + app + db, in the background.
run:
	docker compose up -d --build --remove-orphans

# Development: next dev with HMR on http://localhost:3000, same database. Ctrl-C stops it.
# --renew-anon-volumes picks up dependency changes (node_modules lives in the image).
dev:
	docker compose --profile dev up --build --renew-anon-volumes dev

stop:
	docker compose --profile dev stop

restart:
	docker compose restart

# Removes containers and images; the database volume is kept.
destroy:
	docker compose --profile dev down --rmi local --remove-orphans

# Also deletes the database (chats, reports) and the Tailscale state.
destroy-data:
	@read -p "Delete the database and all volumes? Type 'yes': " answer && [ "$$answer" = yes ]
	docker compose --profile dev down --volumes --rmi local --remove-orphans

logs:
	docker compose logs -f app

status:
	docker compose --profile dev ps

db-shell:
	docker compose exec db sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"'

db-backup:
	@mkdir -p backups
	docker compose exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > backups/cadence-$$(date +%F-%H%M).sql
	@echo "Saved backups/cadence-$$(date +%F-%H%M).sql"
