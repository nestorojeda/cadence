.PHONY: run stop restart destroy logs status

run:
	docker compose up -d --build --remove-orphans

stop:
	docker compose stop

restart:
	docker compose restart

destroy:
	docker compose down --volumes --rmi local

logs:
	docker compose logs -f app

status:
	docker compose ps
