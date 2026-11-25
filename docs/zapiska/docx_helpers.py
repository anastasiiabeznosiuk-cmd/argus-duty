"""Оформлення пояснювальної записки за ДСТУ 3008:2015 (python-docx).

TNR 14, міжрядковий 1,5, поля 25/10/20/20 мм, абзацний відступ 1,25 см, номер сторінки праворуч угорі,
рисунки і таблиці з наскрізною нумерацією в межах розділу, джерела нумеруються за першою згадкою.
"""
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = "Times New Roman"
ALIGN = {
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
}


class Doc:
    def __init__(self, references):
        self.d = Document()
        self.refs = references  # {ключ: бібліографічний опис}
        self.ref_order = []
        self.fig_no, self.tab_no = {}, {}
        self.chapter = 0
        self.n_figs = self.n_tabs = 0
        sec = self.d.sections[0]
        sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)
        sec.left_margin, sec.right_margin = Cm(2.5), Cm(1.0)
        sec.top_margin, sec.bottom_margin = Cm(2.0), Cm(2.0)
        st = self.d.styles["Normal"]
        st.font.name = FONT
        st.font.size = Pt(14)
        st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        pf = st.paragraph_format
        pf.line_spacing = 1.5
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        for lvl in (1, 2, 3):
            h = self.d.styles[f"Heading {lvl}"]
            h.font.name = FONT
            h.font.size = Pt(14)
            h.font.bold = True
            h.font.italic = False
            h.font.color.rgb = RGBColor(0, 0, 0)
            for attr in ("eastAsia", "ascii", "hAnsi", "cs"):
                h.element.rPr.rFonts.set(qn(f"w:{attr}"), FONT)
            h.paragraph_format.space_before = Pt(12 if lvl > 1 else 0)
            h.paragraph_format.space_after = Pt(12)
            h.paragraph_format.keep_with_next = True
            h.paragraph_format.line_spacing = 1.5
        self._page_numbers()

    # ------------------------------------------------------------------ посилання на джерела
    def ref(self, key):
        """Номер джерела в порядку першої згадки: [n]."""
        if key not in self.refs:
            raise KeyError(f"Невідоме джерело: {key}")
        if key not in self.ref_order:
            self.ref_order.append(key)
        return f"[{self.ref_order.index(key) + 1}]"

    def _expand(self, text):
        """Замінює {ключ} на [n]; кілька ключів: {a,b}."""
        out, i = [], 0
        while i < len(text):
            if text[i] == "{":
                j = text.index("}", i)
                keys = [k.strip() for k in text[i + 1:j].split(",")]
                if all(k in self.refs for k in keys):
                    out.append("[" + ", ".join(self.ref(k)[1:-1] for k in keys) + "]")
                else:  # не ключ джерела (наприклад, {id} у шляху API) — лишаємо як є
                    out.append(text[i:j + 1])
                i = j + 1
            else:
                out.append(text[i])
                i += 1
        return "".join(out)

    # ------------------------------------------------------------------ базове
    def _page_numbers(self):
        sec = self.d.sections[0]
        sec.different_first_page_header_footer = True  # на титульному аркуші номера немає
        par = sec.header.paragraphs[0]
        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        self._field(par, "PAGE")

    def _field(self, paragraph, code, placeholder="1", size=None):
        run = paragraph.add_run()
        if size:
            run.font.size = Pt(size)
        for tag in ("begin", "instr", "separate", "text", "end"):
            if tag == "instr":
                el = OxmlElement("w:instrText")
                el.set(qn("xml:space"), "preserve")
                el.text = f" {code} "
            elif tag == "text":
                el = OxmlElement("w:t")
                el.text = placeholder
            else:
                el = OxmlElement("w:fldChar")
                el.set(qn("w:fldCharType"), tag)
                if tag == "begin":
                    el.set(qn("w:dirty"), "true")
            run._r.append(el)
        return run

    def _runs(self, par, text, bold=False, italic=False, size=None):
        text = self._expand(text)
        for i, part in enumerate(text.split("**")):
            if not part:
                continue
            r = par.add_run(part)
            r.bold = bold or (i % 2 == 1)
            r.italic = italic
            if size:
                r.font.size = Pt(size)

    def p(self, text="", bold=False, italic=False, align="justify", indent=True, size=None,
          space_after=0, keep_next=False, line=None):
        par = self.d.add_paragraph()
        par.alignment = ALIGN[align]
        if indent:
            par.paragraph_format.first_line_indent = Cm(1.25)
        par.paragraph_format.space_after = Pt(space_after)
        par.paragraph_format.keep_with_next = keep_next
        if line:
            par.paragraph_format.line_spacing = line
        self._runs(par, text, bold, italic, size)
        return par

    def p_pages(self, before, after):
        """Абзац із полем NUMPAGES (кількість сторінок оновлюється Word-ом)."""
        par = self.d.add_paragraph()
        par.alignment = ALIGN["justify"]
        par.paragraph_format.first_line_indent = Cm(1.25)
        self._runs(par, before)
        self._field(par, "NUMPAGES", placeholder="50")
        self._runs(par, after)

    def dashes(self, items):
        """Перелік без посилань: тире (ДСТУ 3008, 7.7.2)."""
        for it in items:
            self.p("– " + it)

    def lettered(self, items):
        """Перелік з посиланнями: а), б), в) (ДСТУ 3008, 7.7.2)."""
        letters = "абвгдежиклмнпрстуфхцшщюя"
        for i, it in enumerate(items):
            self.p(f"{letters[i]}) {it}")

    def numbered(self, items):
        for i, it in enumerate(items, 1):
            self.p(f"{i}) {it}")

    def note(self, text):
        """Примітка: кегль 12, одинарний інтервал (7.8.3)."""
        self.p("Примітка. " + text, size=12, line=1.0, indent=True, space_after=6)

    def page_break(self):
        self.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def h1(self, text, numbered=True, new_page=True):
        if new_page:
            self.page_break()
        if numbered:
            self.chapter += 1
        h = self.d.add_heading(text.upper(), level=1)
        h.alignment = WD_ALIGN_PARAGRAPH.CENTER
        return h

    def h2(self, text):
        h = self.d.add_heading(text, level=2)
        h.alignment = WD_ALIGN_PARAGRAPH.LEFT
        h.paragraph_format.first_line_indent = Cm(1.25)
        return h

    def h3(self, text):
        h = self.d.add_heading(text, level=3)
        h.alignment = WD_ALIGN_PARAGRAPH.LEFT
        h.paragraph_format.first_line_indent = Cm(1.25)
        return h

    def appendix(self, letter, title):
        """ДОДАТОК А + заголовок посередині (6.2.2); нумерація рисунків і таблиць «А.1»."""
        self.page_break()
        self.chapter = letter
        h = self.d.add_heading(f"ДОДАТОК {letter}", level=1)
        h.alignment = WD_ALIGN_PARAGRAPH.CENTER
        h.paragraph_format.space_after = Pt(0)
        self.p(title, bold=True, align="center", indent=False, space_after=12, keep_next=True)

    def toc(self):
        par = self.d.add_paragraph()
        self._field(par, 'TOC \\o "1-2" \\h \\z \\u', placeholder="Правою кнопкою → «Оновити поле»")

    # ------------------------------------------------------------------ рисунки і таблиці
    def _num(self, store):
        store[self.chapter] = store.get(self.chapter, 0) + 1
        return f"{self.chapter}.{store[self.chapter]}"

    def next_fig(self):
        return f"{self.chapter}.{self.fig_no.get(self.chapter, 0) + 1}"

    def next_tab(self):
        return f"{self.chapter}.{self.tab_no.get(self.chapter, 0) + 1}"

    def fig(self, path, caption, width_cm=15.5, source=None):
        par = self.d.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
        par.paragraph_format.keep_with_next = True
        par.paragraph_format.line_spacing = 1.0
        par.add_run().add_picture(str(path), width=Cm(width_cm))
        n = self._num(self.fig_no)
        self.n_figs += 1
        text = f"Рисунок {n} — {caption}"
        if source:
            text += f" {source}"
        self.p(text, align="center", indent=False, space_after=10)
        return n

    def table(self, rows, caption, widths=None, size=12, header=True):
        n = self._num(self.tab_no)
        self.n_tabs += 1
        self.p(f"Таблиця {n} — {caption}", align="left", indent=True, keep_next=True)
        t = self.d.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                cell = t.cell(i, j)
                cell.text = ""
                par = cell.paragraphs[0]
                par.paragraph_format.line_spacing = 1.0
                par.paragraph_format.first_line_indent = Cm(0)
                par.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r = par.add_run(self._expand(str(val)))
                r.font.size = Pt(size)
                r.bold = header and i == 0
                if widths:
                    cell.width = Cm(widths[j])
            if header and i == 0:  # повторювати головку на наступній сторінці (7.6.9)
                trPr = t.rows[0]._tr.get_or_add_trPr()
                el = OxmlElement("w:tblHeader")
                el.set(qn("w:val"), "true")
                trPr.append(el)
        self.d.add_paragraph().paragraph_format.line_spacing = 1.0
        return n

    def code(self, text, size=10):
        for line in text.rstrip("\n").split("\n"):
            par = self.d.add_paragraph()
            par.paragraph_format.line_spacing = 1.0
            par.paragraph_format.first_line_indent = Cm(0)
            r = par.add_run(line if line else " ")
            r.font.name = "Courier New"
            r._element.rPr.rFonts.set(qn("w:eastAsia"), "Courier New")
            r.font.size = Pt(size)

    def references_list(self):
        for i, key in enumerate(self.ref_order, 1):
            self.p(f"{i}. {self.refs[key]}", indent=True)

    def save(self, path):
        settings = self.d.settings.element
        upd = OxmlElement("w:updateFields")
        upd.set(qn("w:val"), "true")
        settings.append(upd)
        self.d.save(path)
