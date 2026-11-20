import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from beast_os import virgil_notes as V  # noqa: E402

NOTES = """You are Virgil. Beast is the main PC.

## Jellyfin (movies, shows, media server)
Runs on the Event at port 8096.

## Beast TV mode
beast-tv on turns the Panasonic TV on through the Sony receiver.

## Home Assistant (lights, switches, Tuya)
Tuya devices are offline.
"""


class NotesTest(unittest.TestCase):
    def setUp(self):
        self.core, self.notes = V.parse(NOTES)

    def test_core_is_text_before_first_heading(self):
        self.assertEqual(self.core, "You are Virgil. Beast is the main PC.")
        self.assertEqual(len(self.notes), 3)

    def test_title_match_wins(self):
        hits = V.lookup("where are my movies?", self.notes)
        self.assertTrue(hits[0].startswith("Jellyfin"))

    def test_plural_and_body_match(self):
        hits = V.lookup("turn the TV on", self.notes)
        self.assertTrue(hits[0].startswith("Beast TV mode"))

    def test_no_match_no_notes(self):
        self.assertEqual(V.lookup("what's the meaning of life", self.notes), [])

    def test_budget_is_respected(self):
        hits = V.lookup("jellyfin tv lights", self.notes, budget=40)
        self.assertLessEqual(sum(len(h) for h in hits), 40)

    def test_load_rereads_when_file_changes(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "notes.md")
            with open(p, "w") as f:
                f.write("core one\n")
            self.assertEqual(V.load(p)[0], "core one")
            with open(p, "w") as f:
                f.write("core two\n")
            os.utime(p, (time.time() + 5, time.time() + 5))
            self.assertEqual(V.load(p)[0], "core two")

    def test_missing_notebook_is_harmless(self):
        self.assertEqual(V.context_for("hi", {"notes": "/nonexistent/x.md"}), ("", ""))


if __name__ == "__main__":
    unittest.main()
