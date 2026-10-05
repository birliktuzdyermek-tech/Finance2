"""Author-owned synthetic fixtures. All variants of a template stay in one split."""
import csv
from pathlib import Path

# Fixed split before any model evaluation; each language has both labels in test.
TEMPLATES = [
    ("ru", 0, "train", "Покупка на {amount} ₸. Чек доступен в приложении банка."),
    ("ru", 0, "train", "Ваша выписка за месяц готова. Откройте приложение, чтобы посмотреть расходы."),
    ("ru", 0, "train", "Вы получили перевод {amount} ₸. Баланс обновлён."),
    ("ru", 0, "train", "Напоминаем: никогда не сообщайте код из SMS и CVV сотрудникам банка."),
    ("ru", 0, "train", "Отделение банка работает с 9:00 до 18:00. Запись доступна в приложении."),
    ("ru", 0, "train", "Платёж за коммунальные услуги на {amount} ₸ успешно выполнен."),
    ("ru", 0, "train", "Ставки по депозитам опубликованы на https://kaspi.kz."),
    ("ru", 0, "test", "Карта готова к выдаче. Заберите её в выбранном отделении с документом."),
    ("ru", 0, "test", "Сервис временно недоступен из-за технических работ. Попробуйте позже."),
    ("ru", 0, "test", "Не отправляйте пароль никому. Проверяйте уведомления в официальном приложении."),
    ("ru", 1, "train", "Срочно! Счёт будет заблокирован. Введите код из SMS на http://kaspi-verify.example/login."),
    ("ru", 1, "train", "Поздравляем, вы выиграли {amount} ₸! Укажите CVV карты для получения выплаты."),
    ("ru", 1, "train", "Это служба безопасности. Переведите деньги на безопасный счёт прямо сейчас."),
    ("ru", 1, "train", "Подтвердите пароль и номер карты на https://halykbank.kz.fake.example."),
    ("ru", 1, "train", "Возврат {amount} ₸ ожидает подтверждения. Отправьте PIN и код из SMS оператору."),
    ("ru", 1, "train", "Банк обнаружил взлом. Немедленно пришлите данные карты и CVC."),
    ("ru", 1, "train", "Ваш счёт заблокирован. Восстановите доступ по ссылке http://192.0.2.1/bank."),
    ("ru", 1, "test", "Для отмены чужого платежа назовите код подтверждения. Немедленно ответьте на сообщение."),
    ("ru", 1, "test", "Вы выиграли приз. Введите CVV и пароль для доставки https://kaspi-prize.example."),
    ("ru", 1, "test", "Отправьте {amount} ₸ на резервный счёт. Иначе карта попадёт под блокировку."),
    ("en", 0, "train", "Your payment of {amount} KZT is complete. Receipt is available in the bank app."),
    ("en", 0, "train", "Your monthly statement is ready. View it in your mobile banking application."),
    ("en", 0, "train", "Never share your password or OTP with anyone, including bank staff."),
    ("en", 0, "train", "Our office opens at 9 AM. Book your appointment in the mobile application."),
    ("en", 0, "test", "A transfer has arrived. Check the balance in your official bank application."),
    ("en", 0, "test", "Do not enter your CVV on unknown websites. Keep your card details private."),
    ("en", 1, "train", "Urgent: your account will be suspended. Enter your OTP at http://bank-check.example."),
    ("en", 1, "train", "You won a prize of {amount} KZT. Share your card password and CVV to claim it."),
    ("en", 1, "train", "Immediately transfer your money to our safe account to protect your savings."),
    ("en", 1, "train", "Provide your PIN and password to cancel an unauthorized withdrawal."),
    ("en", 1, "test", "Claim your reward now. Send your card number and CVV to the support agent."),
    ("en", 1, "test", "Your account is blocked. Confirm your OTP within 5 minutes at https://halykbank-help.example."),
    ("kz", 0, "train", "Картаңызға {amount} теңге түсті. Балансты банк қосымшасынан көре аласыз."),
    ("kz", 0, "train", "Коммуналдық төлем сәтті орындалды. Түбіртек қосымшада сақталған."),
    ("kz", 0, "train", "Банк бөлімшесі сағат 9:00-де ашылады. Кезекке қосымша арқылы жазылыңыз."),
    ("kz", 0, "train", "Депозит туралы ақпарат https://halykbank.kz сайтында қолжетімді."),
    ("kz", 0, "test", "Айлық есеп дайын. Шығындарды ресми банк қосымшасынан қараңыз."),
    ("kz", 0, "test", "Жаңа карта дайын болды. Жеке куәлікпен бөлімшеге келіңіз."),
    ("kz", 1, "train", "Шұғыл! Шотыңыз бұғатталады. SMS кодты жібере салыңыз http://kaspi-check.example."),
    ("kz", 1, "train", "Сіз {amount} теңге ұтып алдыңыз! CVV кодты енгізіңіз."),
    ("kz", 1, "train", "Ақшаны қауіпсіз шотқа аударыңыз. Дереу әрекет етіңіз."),
    ("kz", 1, "train", "Құпия кодты айтыңыз. Картаңызды тексеру қажет https://forte-bank.example."),
    ("kz", 1, "test", "Дереу PIN кодты жіберіңіз, әйтпесе картаңыз бұғатталады."),
    ("kz", 1, "test", "Сыйақы алу үшін CVV кодты енгізіңіз https://kaspi-gift.example."),
]


def generate():
    destination = Path(__file__).with_name("messages.csv")
    with destination.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["id", "group", "language", "label", "split", "text", "source"])
        writer.writeheader()
        for group, (language, label, split, template) in enumerate(TEMPLATES):
            for variant, amount in enumerate((3500, 18000, 42000)):
                writer.writerow(dict(id=f"g{group:02d}v{variant}", group=f"g{group:02d}", language=language,
                                     label=label, split=split, text=template.format(amount=amount), source="authored_synthetic"))
    return destination


if __name__ == "__main__":
    print(generate())
