"""Build the app's compact data file from the school-choice database Markdown.

Usage: python3 scripts/build_data.py [source.md] [out.json]

The Markdown embeds one canonical JSON block between BEGIN_APP_DATA and END_APP_DATA.
This script keeps only what the app shows, under short keys, and never fills a gap with zero.
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent.parent
SRC = HERE / "data/source/sg-secondary-school-choice-database-2024-2025.md"
OUT = HERE / "data/schools.json"

GENDER = {"Co-Ed School": "coed", "Boys School": "boys", "Girls School": "girls"}


def load(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"<!-- BEGIN_APP_DATA -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- END_APP_DATA -->", text)
    if not m:
        raise SystemExit("Embedded school database not found")
    db = json.loads(m.group(1))
    if db["schema_version"] != "1.1.0":
        raise SystemExit(f"Unsupported schema {db['schema_version']}")
    return db


def coords(map_url):
    if not map_url:
        return None, None
    q = parse_qs(urlparse(map_url).query)
    try:
        return round(float(q["lat"][0]), 6), round(float(q["lng"][0]), 6)
    except (KeyError, ValueError):
        return None, None


def cutoff(r: dict) -> dict:
    return {
        "y": r["posting_year"],
        "route": r["route"],
        "pg": r["posting_group"],
        "prog": r["programme"],
        "code": r["programme_choice_code"],
        "aff": r["affiliation"] == "affiliated",
        "status": r["record_status"],
        "first": r["first_posted_al"],
        "firstHcl": r["first_posted_hcl_grade"],
        "cop": r["cop_al"],
        "copHcl": r["cop_hcl_grade"],
        "raw": r["published_range_raw"],
    }


def metric(m: dict) -> dict:
    return {
        "label": m["label"],
        "value": m["value"],
        "unit": m["unit"],
        "op": m.get("comparison_operator"),
        "cohort": m["cohort"],
        "denominator": m["denominator"],
        "scope": m.get("result_scope"),
        "url": m["source_url"],
        "sourceTitle": m.get("source_title"),
        "summary": m.get("evidence_summary"),
        "flags": m.get("provenance_flags") or [],
    }


def build(db: dict) -> dict:
    profiles = {p["school_id"]: p for p in db["holistic_profiles"]}
    metrics = {m["metric_id"]: m for m in db["olevel_metrics"]}
    notes = {n["school_id"]: n for n in db["olevel_school_notes"]}
    audits: dict[str, list] = {}
    for a in db["olevel_results_audit"]:
        audits.setdefault(a["school_id"], []).append(a)
    cutoffs: dict[str, list] = {}
    for r in db["cutoff_records"]:
        cutoffs.setdefault(r["school_id"], []).append(cutoff(r))

    schools = []
    for s in db["schools"]:
        sid = s["school_id"]
        p = profiles[sid]
        addr = p.get("address") or {}
        lat, lng = coords(addr.get("map_url"))
        olevel = []
        for a in sorted(audits.get(sid, []), key=lambda a: a["exam_year"]):
            olevel.append({
                "year": a["exam_year"],
                "status": a["status"],
                "notes": a.get("limitations") or [],
                "metrics": [metric(metrics[i]) for i in a.get("metric_ids", []) if i in metrics],
            })
        schools.append({
            "id": sid,
            "name": s["school_name"],
            "code": s["moe_school_code"],
            "ipCode": s["moe_ip_school_code"],
            "area": s["area"],
            "type": s["school_type"],
            "sap": bool(s["sap_school"]),
            "ip": s["ip_school_flag_raw"] not in (None, "N"),
            "gender": GENDER.get(s["directory_gender_raw"], "coed"),
            "genderVerified": s["sec1_gender_eligibility"],
            "admission": s["admission_model"],
            "ordinary": bool(s["participates_in_ordinary_s1_posting_as_of_snapshot"]),
            "admissionNote": s["admission_note"],
            "affiliatedPrimary": s["affiliated_primary_school_ids"],
            "moeUrl": s["source_url"],
            "web": p.get("school_website_url"),
            "street": addr.get("street"),
            "postal": addr.get("postal_code"),
            "lat": lat,
            "lng": lng,
            "programmes": [
                {"kind": x["kind"], "name": x["name"], "domain": x.get("domain")} for x in p["programmes"]
            ],
            "extraProgrammes": [
                {"name": x["name"], "value": x.get("student_value_interpretation")} for x in p["additional_programmes"]
            ],
            "strengths": [
                {"name": x["offering"], "fact": x["fact"], "value": x["student_value_interpretation"], "url": x["source_url"]}
                for x in p["documented_strengths"]
            ],
            "electives": [x["name"] for x in p["elective_programmes"]],
            "ccas": [
                {"n": x["name"], "c": x["category"], "g": x["gender_eligibility_directory"]} for x in p["cca_offerings"]
            ],
            "dsa": [{"n": x["name"], "c": x["category"]} for x in p["dsa_talent_areas"]],
            "support": [x["name"] for x in p["support_resources"]],
            "constraints": [
                {"kind": x["kind"], "fact": x["fact"], "means": x["student_implication"], "url": x["source_url"]}
                for x in p["verified_constraints"]
            ],
            "questions": [{"type": x["type"], "text": x["text"]} for x in p["fit_considerations"]],
            "campusNotes": [x["text"] for x in p["campus_and_name_notes"]],
            "conflicts": [
                {"topic": x.get("topic"), "resolution": x.get("resolution")} for x in p["information_conflicts"]
            ],
            "tags": p.get("interest_tags") or [],
            "olevel": olevel,
            "olevelNote": (notes.get(sid) or {}).get("route_notes"),
            "cutoffs": cutoffs.get(sid, []),
        })

    return {
        "datasetId": db["dataset_id"],
        "asOf": db["as_of_date"],
        "postingYears": db["posting_years"],
        "planningIntakeYear": db["planning_intake_year"],
        "bands": db["posting_group_guidance"]["bands"],
        "rules": [{"id": r["rule_id"], "kind": r["kind"], "text": r["text"]} for r in db["application_rules"]],
        "statusDefinitions": db["status_definitions"],
        "olevelStatusDefinitions": db["olevel_result_status_definitions"],
        "nationalContext": db["olevel_national_context"],
        "primarySchools": sorted(
            [{"id": p["primary_school_id"], "name": p["school_name"]} for p in db["primary_schools"]],
            key=lambda p: p["name"],
        ),
        "affiliations": [[a["primary_school_id"], a["secondary_school_id"]] for a in db["affiliations"]],
        "schools": sorted(schools, key=lambda s: s["name"]),
    }


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    data = build(load(src))
    missing = [s["name"] for s in data["schools"] if s["lat"] is None]
    if missing:
        raise SystemExit(f"Schools without coordinates: {missing}")
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(data['schools'])} schools, {sum(len(s['cutoffs']) for s in data['schools'])} cut-offs -> {out} "
          f"({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
