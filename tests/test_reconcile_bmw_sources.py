"""Synthetic source-ledger checks; no original BMW rows are committed."""

import hashlib
import io
import json
from contextlib import closing

from openpyxl import Workbook
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from database.store import connect
from scripts.reconcile_bmw_sources import METHOD, reconcile
from server.platform import run_capability


def _workbook() -> bytes:
    book = Workbook()
    sheet = book.active
    sheet.title = "Feedback"
    sheet.append(["ID", "Country", "Derivate (e-code)", "Customer Feedback", "Date"])
    sheet.append(["one", "US", "G60", "Synthetic seat feedback", "2025-03-01"])
    sheet.append(["two", "GB", "G60", "Synthetic display feedback", None])
    book.create_sheet("Empty")
    output = io.BytesIO()
    book.save(output)
    return output.getvalue()


def _pdf() -> bytes:
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page = writer.add_blank_page(width=300, height=300)
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 250 Td (Synthetic option) Tj ET")
    page[NameObject("/Contents")] = stream
    writer.add_blank_page(width=300, height=300)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_reconciles_parser_import_storage_and_repeat_without_source_text(db, tmp_path, monkeypatch):
    root = tmp_path / "data"
    folder = root / "BMW-Data"
    folder.mkdir(parents=True)
    workbook = _workbook()
    pdf = _pdf()
    (folder / "G60_feedback.xlsx").write_bytes(workbook)
    (folder / "G60_OptionList.PDF").write_bytes(pdf)
    monkeypatch.setenv("DATA_DIR", str(root))
    first = run_capability("market_data.import_bmw", {"directory": "BMW-Data"}, "system:test")["outputs"]
    repeat = run_capability("market_data.import_bmw", {"directory": "BMW-Data"}, "system:test")["outputs"]
    manifest = {
        "files": [
            {
                "path": "data/BMW-Data/" + name,
                "kind": "google-drive-input",
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
            for name, data in (("G60_feedback.xlsx", workbook), ("G60_OptionList.PDF", pdf))
        ]
        + [
            {
                "path": "materials/BMW-Group-Report-2025-en.pdf",
                "kind": "external-document",
                "bytes": 1,
                "sha256": "0" * 64,
            }
        ]
    }
    with closing(connect()) as connection:
        result = reconcile(folder, first, repeat, manifest, connection)
    assert result["method_version"] == METHOD
    assert result["totals"] == {
        "files": 2,
        "scopes": 4,
        "parsed_records": 4,
        "stored_records": 4,
        "same_source_duplicate_records": 0,
        "first_pass_new_evidence": 4,
        "repeat_new_evidence": 0,
    }
    by_name = {item["path"].split("/")[-1]: item for item in result["files"]}
    assert by_name["G60_feedback.xlsx"]["surfaces"] == {"sheets": 2, "ignored_sheets": ["Empty"]}
    assert by_name["G60_OptionList.PDF"]["surfaces"] == {"pages": 2, "ignored_pages": [2]}
    assert {item["assignment"] for item in by_name["G60_OptionList.PDF"]["scopes"]} == {"expanded_from_source"}
    assert sorted(item["observed_dates"] for item in by_name["G60_feedback.xlsx"]["scopes"]) == [0, 1]
    assert all(item["sample_locator"] for source in result["files"] for item in source["scopes"])
    assert result["missing_manifest_inputs"] == ["BMW-Group-Report-2025-en.pdf"]
    assert not result["annual_report_in_import"]
    assert "Synthetic seat feedback" not in json.dumps(result)


def test_manifest_hash_mismatch_fails_reconciliation(db, tmp_path, monkeypatch):
    folder = tmp_path / "BMW-Data"
    folder.mkdir()
    data = _workbook()
    (folder / "G60_feedback.xlsx").write_bytes(data)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    first = run_capability("market_data.import_bmw", {"directory": "BMW-Data"}, "system:test")["outputs"]
    repeat = run_capability("market_data.import_bmw", {"directory": "BMW-Data"}, "system:test")["outputs"]
    manifest = {
        "files": [
            {
                "path": "data/BMW-Data/G60_feedback.xlsx",
                "kind": "google-drive-input",
                "bytes": len(data),
                "sha256": "0" * 64,
            }
        ]
    }
    with closing(connect()) as connection:
        try:
            reconcile(folder, first, repeat, manifest, connection)
        except AssertionError as exc:
            assert "manifest" in str(exc)
        else:
            raise AssertionError("A changed source must fail the manifest check")
