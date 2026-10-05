import re
import unittest

from backend.reports import make_pdf


class ReportDesignTests(unittest.TestCase):
    def report(self):
        return {
            "id": "example-check", "created_at": "2026-10-05T12:30:00+00:00",
            "score": 87, "verdict": "high", "rules_score": 87, "ml_score": None,
            "channel": "sms", "scheme": {"title": "Служба безопасности банка"},
            "signals": [{"title": "Срочность в тексте", "weight": 20}],
            "urls": [{"host": "kaspi-login.example", "official": False}],
            "advice": "Свяжитесь со своим банком через официальное приложение.",
            "limitations": ["Риск-балл не является вероятностью мошенничества."],
        }

    def test_untrusted_markup_is_printed_without_becoming_a_flowable(self):
        result = self.report()
        result["urls"][0]["host"] = '<img src="/does-not-exist.png"/><b>қазақша & русский</b>'
        result["signals"][0]["title"] = '<broken>құпия & CVV</broken>'
        pdf = make_pdf(result)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertEqual(len(re.findall(rb"/Type\s*/Page\b", pdf)), 1)

    def test_long_derived_fields_paginate_without_layout_errors(self):
        result = self.report()
        result["signals"] = [
            {"title": "Длинный признак қазақстандық " * 22, "weight": 5}
            for _ in range(28)
        ]
        result["urls"] = [{"host": "поддомен-" * 45 + ".example", "official": False} for _ in range(20)]
        pdf = make_pdf(result)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(re.findall(rb"/Type\s*/Page\b", pdf)), 2)


if __name__ == "__main__":
    unittest.main()
