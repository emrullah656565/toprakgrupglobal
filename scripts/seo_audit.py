#!/usr/bin/env python3
"""Read-only SEO audit. Run: python3 scripts/seo_audit.py https://example.com"""
import sys, urllib.request, urllib.parse, html.parser, json, datetime
from urllib.error import HTTPError, URLError

class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.title=False; self.titles=[]; self.descriptions=[]; self.canonicals=[]; self.h1=0; self.lang=None; self.robots=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="html": self.lang=a.get("lang")
        if tag=="title": self.title=True
        if tag=="h1": self.h1+=1
        if tag=="meta" and a.get("name","").lower()=="description": self.descriptions.append(a.get("content",""))
        if tag=="meta" and a.get("name","").lower()=="robots": self.robots.append(a.get("content",""))
        if tag=="link" and a.get("rel","").lower()=="canonical": self.canonicals.append(a.get("href",""))
    def handle_endtag(self,tag):
        if tag=="title": self.title=False
    def handle_data(self,data):
        if self.title: self.titles.append(data)

def fetch(url):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"ToprakSEOAudit/1.0"})
        with urllib.request.urlopen(req,timeout=15) as r:
            return {"status":r.status,"final_url":r.url,"body":r.read(500000).decode("utf-8","replace")}
    except (HTTPError,URLError,TimeoutError) as e:
        return {"error":str(e)}

def main():
    if len(sys.argv)!=2 or not sys.argv[1].startswith("https://"): raise SystemExit("Usage: python3 scripts/seo_audit.py https://your-domain")
    root=sys.argv[1].rstrip("/")
    checks={p:fetch(root+p) for p in ["/","/robots.txt","/sitemap.xml"]}
    p=Page()
    if "body" in checks["/"]: p.feed(checks["/"]["body"])
    report={"timestamp_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"site":root,"pages":{k:{x:y for x,y in v.items() if x!="body"} for k,v in checks.items()},"home":{"title":"".join(p.titles).strip(),"description":p.descriptions,"canonical":p.canonicals,"html_lang":p.lang,"h1_count":p.h1,"robots_meta":p.robots},"warnings":[]}
    if not report["home"]["title"]: report["warnings"].append("Missing HTML title")
    if not p.descriptions: report["warnings"].append("Missing meta description")
    if not p.canonicals: report["warnings"].append("Missing canonical")
    if not p.lang: report["warnings"].append("Missing HTML lang")
    if p.h1!=1: report["warnings"].append("Expected exactly one H1")
    for path in ["/robots.txt","/sitemap.xml"]:
        if checks[path].get("status")!=200: report["warnings"].append(path+" not HTTP 200")
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=="__main__": main()
