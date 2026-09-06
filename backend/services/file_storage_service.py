"""
Stockage des fichiers uploadés (images produit, documents KYC).

Contexte : le disque local d'un service Render (plan gratuit, sans disque
persistant) est réinitialisé à chaque redéploiement — tout fichier écrit
dans backend/static/uploads/ disparaît alors que la base de données garde
la référence, laissant un lien mort. Ce module bascule vers ImageKit
(stockage persistant + CDN) dès que les identifiants sont configurés, et
ne se rabat sur le disque local que pour le développement sans clés
ImageKit — jamais souhaitable en production.
"""
import os
import uuid

import requests

import backend.config as config

IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload"


def is_imagekit_configured() -> bool:
    return bool(config.IMAGEKIT_PRIVATE_KEY and config.IMAGEKIT_PUBLIC_KEY and config.IMAGEKIT_URL_ENDPOINT)


def _upload_to_imagekit(contents: bytes, filename: str, folder: str) -> str:
    response = requests.post(
        IMAGEKIT_UPLOAD_URL,
        auth=(config.IMAGEKIT_PRIVATE_KEY, ""),
        data={
            "fileName": filename,
            "folder": folder,
            "useUniqueFileName": "false",
        },
        files={"file": (filename, contents)},
        timeout=20,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Échec de l'upload ImageKit ({response.status_code}): {response.text[:300]}")
    data = response.json()
    url = data.get("url")
    if not url:
        raise RuntimeError(f"Réponse ImageKit inattendue, pas d'URL renvoyée: {data}")
    return url


def _upload_to_local_disk(contents: bytes, filename: str, local_dir: str, url_prefix: str) -> str:
    os.makedirs(local_dir, exist_ok=True)
    file_path = os.path.join(local_dir, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    return f"{url_prefix}/{filename}"


def store_uploaded_file(contents: bytes, original_filename: str, *, prefix: str, folder: str, local_dir: str, local_url_prefix: str) -> str:
    """
    Stocke un fichier uploadé et renvoie son URL publique.

    - `prefix` : préfixe du nom de fichier généré (ex: "prod_12", "kyc_5").
    - `folder` : dossier ImageKit cible (ex: "/products/", "/kyc/").
    - `local_dir` / `local_url_prefix` : chemin disque et préfixe d'URL de
      repli (dev sans clés ImageKit) — fournis par l'appelant plutôt que
      codés en dur ici, pour rester substituables dans les tests (voir
      products_router.UPLOAD_DIR / users_router.KYC_UPLOAD_DIR).
    """
    extension = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.{extension}"

    if is_imagekit_configured():
        return _upload_to_imagekit(contents, filename, folder)

    return _upload_to_local_disk(contents, filename, local_dir, local_url_prefix)
