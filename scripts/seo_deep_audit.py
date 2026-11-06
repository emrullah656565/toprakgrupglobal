#!/usr/bin/env python3
"""Read-only deep SEO/HTTP audit. Usage: python3 scripts/seo_deep_audit.py https://example.com [path ...]"""
import datetime
import html.parser
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

class Parser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_active = False
        self.titles = []
        self.description = []
        self.canonical = []
        self.hreflang = []
        self.robots = []
        self.h1 = 0
        self.lang = None
        self.text_length = 0
        self.main_text_length = 0
        self.in_main = 0
        self.viewport = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang")
        if tag == "title": self.title_active = True
        if tag == "main": self.in_main += 1
        if tag == "h1": self.h1 += 1
        if tag == "meta":
            if a.get("name", "").lower() == "description": self.description.append(a.get("content", ""))
            if a.get("name", "").lower() in ("robots", "googlebot"): self.robots.append(a.get("content", ""))
            if a.get("name", "").lower() == "viewport": self.viewport = True
        if tag == "link":
            rel = a.get("rel", "").lower().split()
            if "canonical" in rel: self.canonical.append(a.get("href", ""))
            if "alternate" in rel and a.get("hreflang"): self.hreflang.append({"lang": a["hreflang"], "href": a.get("href", "")})
    def handle_endtag(self, tag):
        if tag == "title": self.title_active = False
        if tag == "main" and self.in_main: self.in_main -= 1
    def handle_data(self, data):
        if self.title_active: self.titles.append(data)
        value = data.strip()
        self.text_length += len(value)
        if self.in_main: self.main_text_length += len(value)

def get(url, agent="ToprakSEOAudit/2.0"):
    request = urllib.request.Request(url, headers={"User-Agent": agent, "Accept": "text/html,application/xml,text/plain,*/*"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = response.read(900000)
            return {"status": response.status, "final_url": response.url, "content_type": response.headers.get("Content-Type", ""), "x_robots_tag": response.headers.get("X-Robots-Tag", ""), "body": data.decode("utf-8", "replace")}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "final_url": e.url, "content_type": e.headers.get("Content-Type", ""), "body": e.read(100000).decode("utf-8", "replace")}
    except Exception as e:
        return {"error": str(e)}

def inspect(path, response, warnings):
    summary = {k:v for k,v in response.items() if k != "body"}
    if "body" not in response: return summary
    if path.endswith(".txt") or path.endswith(".xml"): return summary
    p = Parser()
    p.feed(response["body"])
    summary.update({"title": "".join(p.titles).strip(), "meta_description": p.description, "canonical": p.canonical, "hreflang": p.hreflang, "html_lang": p.lang, "h1_count": p.h1, "raw_text_characters": p.text_length, "main_text_characters": p.main_text_length, "viewport": p.viewport, "robots_meta": p.robots})
    if response.get("status") != 200: warnings.append(path + ": HTTP status not 200")
    if response.get("status") == 200:
        if not summary["title"]: warnings.append(path + ": missing title")
        if not p.description: warnings.append(path + ": missing description")
        if not p.canonical: warnings.append(path + ": missing canonical")
        if not p.viewport: warnings.append(path + ": missing viewport")
        if p.h1 != 1: warnings.append(path + ": H1 count " + str(p.h1) + " (raw HTML only; JS-rendered content not measured)")
        if p.main_text_length < 80: warnings.append(path + ": little raw <main> text; check JS rendering / Googlebot")
        if any("noindex" in x.lower() for x in p.robots) or "noindex" in response.get("x_robots_tag", "").lower(): warnings.append(path + ": NOINDEX signal")
    return summary

def main():
    if len(sys.argv) < 2: raise SystemExit("Usage: seo_deep_audit.py https://domain [path ...]")
    base = sys.argv[1].rstrip("/")
    if not base.startswith("https://"): raise SystemExit("HTTPS required")
    parsed = urllib.parse.urlparse(base)
    if parsed.path not in ("", "/") or parsed.query: raise SystemExit("Pass site origin only")
    paths = ["/", "/robots.txt", "/sitemap.xml", "/__seo_nonexistent_check_9f37"]
    for arg in sys.argv[2:]:
        if not arg.startswith("/") or arg.startswith("//") or "://" in arg: raise SystemExit("Paths must be relative")
        if arg not in paths: paths.append(arg)
    warnings = []
    results = {}
    for path in paths:
        r = get(base + path)
        results[path] = inspect(path, r, warnings)
        if path == "/robots.txt" and r.get("status") == 200:
            if "Sitemap:" not in r.get("body", ""): warnings.append("robots.txt: missing Sitemap directive")
            if re.search(r"(?im)^Disallow:\s*/\s*$", r.get("body", "")): warnings.append("robots.txt: sitewide Disallow")
        if path == "/sitemap.xml" and r.get("status") == 200:
            try:
                root = ET.fromstring(r.get("body", ""))
                entries = root.findall(".//{*}loc")
                results[path]["xml_root"] = root.tag.rsplit("}", 1)[-1]
                results[path]["url_entries"] = len(entries)
                results[path]["sample_urls"] = [x.text for x in entries[:10]]
            except ET.ParseError as e: warnings.append("sitemap.xml: invalid XML: " + str(e))
        if path == "/__seo_nonexistent_check_9f37":
            if r.get("status") != 404: warnings.append("Unknown route should return HTTP 404; got " + str(r.get("status", r.get("error", "error"))))
        if "error" in r: warnings.append(path + ": network error: " + r["error"])
    print(json.dumps({"timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "site": base, "checks": results, "warnings": warnings, "limitations": ["Raw HTTP HTML only: JavaScript rendering, real mobile layout, Core Web Vitals and actual Google indexing require separate tools.", "Network errors are not proof of site outage."]}, ensure_ascii=False, indent=2))
if __name__ == "__main__": main()
