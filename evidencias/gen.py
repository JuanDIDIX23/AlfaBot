import html, re
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import HtmlFormatter
from playwright.sync_api import sync_playwright
ROOT="/home/claude/alfabot-inferencia/"
fmt=HtmlFormatter(style="monokai", nowrap=True)
CSS=f"""
body{{margin:0;background:#FAF7F1;padding:24px;font-family:Helvetica,Arial,sans-serif}}
.win{{width:1080px;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.25);background:#272822}}
.bar{{background:#3a3b36;color:#d8d8d0;font:13px 'DejaVu Sans Mono',monospace;padding:9px 14px;display:flex;align-items:center;gap:8px}}
.dot{{width:12px;height:12px;border-radius:50%;display:inline-block}}
pre{{margin:0;padding:14px 16px;font:14px/1.45 'DejaVu Sans Mono',monospace;color:#f8f8f2;white-space:pre}}
.ln{{color:#75715e;display:inline-block;width:42px;text-align:right;margin-right:16px;user-select:none}}
{fmt.get_style_defs('.hl')}
.term{{background:#1b1f1d}} .term pre{{color:#d8e4dc}} .term .bar{{background:#2c332f}}
"""
def win(title, body, term=False):
    return f"<div class='win {'term' if term else ''}'><div class='bar'><span class='dot' style='background:#ff5f56'></span><span class='dot' style='background:#ffbd2e'></span><span class='dot' style='background:#27c93f'></span><span style='margin-left:10px'>{html.escape(title)}</span></div><pre class='hl'>{body}</pre></div>"
def code(path, a, b, lang, title=None):
    lines=open(ROOT+path,encoding="utf8").read().split("\n")[a-1:b]
    hl=highlight("\n".join(lines),get_lexer_by_name(lang),fmt).split("\n")
    out="\n".join(f"<span class='ln'>{a+i}</span>{l}" for i,l in enumerate(hl))
    return win(title or f"{path}  (líneas {a}–{b})", out)
def term(title, text):
    t=html.escape(text)
    t=re.sub(r"(█+)",r"<span style='color:#5fb59a'>\1</span>",t)
    t=re.sub(r"(░+)",r"<span style='color:#4a524e'>\1</span>",t)
    t=re.sub(r"^(\s+OK\s)",lambda m:m.group(1).replace("OK","<span style='color:#6fd08c'>OK</span>"),t,flags=re.M)
    t=re.sub(r"(FALLA)",r"<span style='color:#ff8a65'>\1</span>",t)
    return win(title,t,True)
def shot(name, inner, width=1130):
    open(f"{name}.html","w",encoding="utf8").write(f"<html><head><meta charset='utf8'><style>{CSS}</style></head><body>{inner}</body></html>")
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={"width":width,"height":400},device_scale_factor=2)
        pg.goto(f"file:///home/claude/alfabot-inferencia/evidencias/{name}.html")
        pg.locator(".win").first.screenshot(path=f"{name}.png"); b.close()
def grep_line(path, pat):
    for i,l in enumerate(open(ROOT+path,encoding="utf8"),1):
        if pat in l: return i
    raise SystemExit("no "+pat)
mb=grep_line("src/negocio/MotorBayes.ts","actualizar(creencias")
shot("ev_motor", code("src/negocio/MotorBayes.ts", mb-1, mb+14,"typescript"))
sp=grep_line("src/negocio/SelectorPregunta.ts","gananciaEsperada(creencias")
shot("ev_selector", code("src/negocio/SelectorPregunta.ts", sp, sp+20,"typescript"))
rp=grep_line("src/datos/ConocimientoRepositorioPg.ts","async matrizDeNodo")
shot("ev_repo", code("src/datos/ConocimientoRepositorioPg.ts", rp+13, rp+24,"typescript")
     .replace("</div></div>","</div></div>",1)) if False else None
shot("ev_repo", code("src/datos/ConocimientoRepositorioPg.ts", rp+13, rp+24,"typescript"))
ses=grep_line("src/negocio/SesionDiagnostico.ts","async responder")
shot("ev_sesion", code("src/negocio/SesionDiagnostico.ts", ses-1, ses+24,"typescript"))
ex=open("ejecucion1.txt",encoding="utf8").read().rstrip("\n").split("\n")
i2=[i for i,l in enumerate(ex) if l.startswith("Pregunta 2")][0]
shot("ev_consola1", term("npm start — inicio y primeras preguntas","\n".join(ex[:i2+12])))
ir=[i for i,l in enumerate(ex) if "=== Resultado" in l][0]
shot("ev_consola2", term("npm start — resultado y plan de actividades","\n".join(ex[ir:])))
pr=open("pruebas.txt",encoding="utf8").read().rstrip("\n").split("\n")
shot("ev_pruebas", term("npm run pruebas","\n".join(pr)))
shot("ev_sql", term("psql — consultas a la base de conocimiento", open("consultas.txt",encoding="utf8").read().split("hipotesis_id")[0].rstrip()))
print("ok")
