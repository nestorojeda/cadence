.PHONY: run stop restart destroy logs status

run:
	docker compose up -d --build

stop:
	docker compose stop

restart:
	docker compose restart

destroy:
	docker compose down --volumes --rmi local

logs:
	docker compose logs -f cadence

status:
	docker compose ps
