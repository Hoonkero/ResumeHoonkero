from html import escape
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import quote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"
CONTENT = ROOT / "content"
IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
PAGES = ("index.html", "documents/index.html", "contacts/index.html")


def natural_order(name):
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", name.casefold())]


def read_document(folder):
    sources = sorted(
        (image for image in folder.iterdir()
         if image.is_file() and not image.name.startswith(".") and image.suffix.lower() in IMAGES),
        key=lambda image: natural_order(image.name),
    )
    if not sources:
        return None

    fields = {"Тип": "", "Организация": "", "Год": "", "Образец": ""}
    heading = folder.name.replace("-", " ")
    description = []
    description_file = folder / "description.md"
    if description_file.exists():
        for line in description_file.read_text(encoding="utf-8-sig").splitlines():
            key, separator, value = line.partition(":")
            if line.startswith("# "):
                heading = line[2:].strip()
            elif separator and key.strip() in fields:
                fields[key.strip()] = value.strip()
            else:
                description.append(line)

    return {
        "id": folder.name,
        "title": heading,
        "type": fields["Тип"] or "Документ",
        "issuer": fields["Организация"],
        "year": fields["Год"],
        "example": fields["Образец"].casefold() == "да",
        "description": "\n".join(description).strip(),
        "sources": sources,
    }


def copy_asset(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def build_documents(output):
    folders = sorted((CONTENT / "documents").iterdir(), key=lambda folder: natural_order(folder.name))
    documents = [
        document for folder in folders
        if folder.is_dir() and not folder.name.startswith(".")
        if (document := read_document(folder)) is not None
    ]
    if any(not document["example"] for document in documents):
        documents = [document for document in documents if not document["example"]]

    for document in documents:
        document["pages"] = []
        for source in document.pop("sources"):
            target = Path("media/documents") / document["id"] / source.name
            copy_asset(source, output / target)
            document["pages"].append(quote(target.as_posix()))
    return documents


def build_experience(output):
    markdown = (CONTENT / "experience.md").read_text(encoding="utf-8-sig")
    organizations = []
    for section in re.split(r"(?m)^## ", markdown)[1:]:
        title, _, body = section.partition("\n")
        organization = {"name": title.strip(), "description": ""}
        paragraphs = []
        for line in body.splitlines():
            line = line.strip()
            logo = re.fullmatch(r"!\[[^\]]*\]\((.+)\)", line)
            link = re.fullmatch(r"\[[^\]]+\]\(([^)]+)\)", line)
            if logo:
                path = Path(logo[1])
                source = (CONTENT / path).resolve()
                if (source.is_relative_to(CONTENT / "logos")
                        and source.suffix.lower() in IMAGES | {".svg"} and source.is_file()):
                    target = Path("media") / source.relative_to(CONTENT)
                    copy_asset(source, output / target)
                    organization["logo"] = quote(target.as_posix())
                else:
                    print(f"Логотип для «{organization['name']}» пропущен: {path}")
            elif link and urlsplit(link[1]).scheme in {"http", "https"}:
                organization["url"] = link[1]
            else:
                paragraphs.append(line)
        organization["description"] = "\n".join(paragraphs).strip()
        organizations.append(organization)
    return organizations


def write_pages(output, profile):
    header = (SOURCE / "_header.html").read_text(encoding="utf-8")
    footer = (SOURCE / "_footer.html").read_text(encoding="utf-8")
    for page in PAGES:
        source = (SOURCE / page).read_text(encoding="utf-8")
        html = (source.replace("<!-- SITE_HEADER -->", header)
                .replace("<!-- SITE_FOOTER -->", footer)
                .replace("{{NAME}}", escape(profile["name"], quote=True))
                .replace("{{FULL_NAME}}", escape(profile["fullName"], quote=True))
                .replace("{{INTRO}}", escape(profile["intro"]))
                .replace("{{FIRST_ROLE}}", escape(profile["roles"][0]["name"]))
                .replace("{{PORTRAIT}}", quote(profile["portrait"]))
                .replace("{{ROOT}}", "../" if "/" in page else "./")
                .replace("{{CONTACT_CURRENT}}", 'aria-current="page"' if page.startswith("contacts/") else ""))
        target = output / page
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")


def main():
    profile = json.loads((CONTENT / "profile.json").read_text(encoding="utf-8-sig"))
    destination = ROOT / "dist"
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        output = Path(temporary) / "site"
        shutil.copytree(SOURCE / "assets", output / "assets")
        for filename in ("main.js", "styles.css"):
            copy_asset(SOURCE / filename, output / filename)
        data = {
            **profile,
            "documents": build_documents(output),
            "experience": build_experience(output),
        }
        write_pages(output, profile)
        (output / "resume-data.js").write_text(
            "export default " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
            encoding="utf-8",
        )
        (output / ".nojekyll").touch()
        if destination.exists():
            shutil.rmtree(destination)
        output.rename(destination)
    print(f"Сайт собран в {destination}")


if __name__ == "__main__":
    main()
