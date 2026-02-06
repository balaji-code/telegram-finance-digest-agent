import os
import json
from urllib.parse import quote_plus
from typing import Any

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4.1-mini')

app = FastAPI(title='Book Extraction API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class ExtractRequest(BaseModel):
    image_base64: str


class ExtractResponse(BaseModel):
    title: str
    author: str
    description: str
    category: str
    price: str
    rating: str
    amazon_url: str


def _extract_json_text(body: dict[str, Any]) -> str:
    # Some responses include a convenience field.
    output_text = body.get('output_text')
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    # Fallback to structured output array.
    output = body.get('output')
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get('content')
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, dict):
                    continue
                text_value = part.get('text')
                if isinstance(text_value, str) and text_value.strip():
                    return text_value

    return ''


def normalize_category(category: str) -> str:
    allowed = {
        'Science',
        'Technology',
        'Mathematics',
        'History',
        'Literature',
        'Business',
        'Self-Help',
        'Other',
    }

    clean = category.strip()
    return clean if clean in allowed else 'Other'


async def lookup_amazon_india(title: str, author: str) -> dict[str, str]:
    query = quote_plus(f'{title} {author} book')
    url = f'https://www.amazon.in/s?k={query}&i=stripbooks'

    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
        ),
        'Accept-Language': 'en-IN,en;q=0.9',
    }

    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError:
        return {'price': 'N/A', 'rating': 'N/A', 'amazon_url': ''}

    soup = BeautifulSoup(response.text, 'html.parser')
    first_result = soup.select_one('div.s-main-slot div[data-component-type="s-search-result"]')
    if not first_result:
        return {'price': 'N/A', 'rating': 'N/A', 'amazon_url': ''}

    price_tag = first_result.select_one('span.a-price span.a-offscreen')
    rating_tag = first_result.select_one('span.a-icon-alt')
    link_tag = first_result.select_one('a.a-link-normal.s-no-outline')

    raw_href = link_tag.get('href', '').strip() if link_tag else ''
    full_url = f'https://www.amazon.in{raw_href}' if raw_href.startswith('/') else raw_href

    return {
        'price': price_tag.get_text(strip=True) if price_tag else 'N/A',
        'rating': rating_tag.get_text(strip=True) if rating_tag else 'N/A',
        'amazon_url': full_url,
    }


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/extract-book', response_model=ExtractResponse)
async def extract_book(payload: ExtractRequest) -> ExtractResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail='Server missing OPENAI_API_KEY')

    if not payload.image_base64.strip():
        raise HTTPException(status_code=400, detail='image_base64 is required')

    request_payload: dict[str, Any] = {
        'model': OPENAI_MODEL,
        'input': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'input_text',
                        'text': (
                            'First decide if this image is a book cover. '
                            'Return strict JSON with: is_book, title, author, description, category. '
                            'If image is not a book, set is_book=false and keep other fields empty strings. '
                            'Category must be one of Science, Technology, Mathematics, '
                            'History, Literature, Business, Self-Help, Other.'
                        ),
                    },
                    {
                        'type': 'input_image',
                        'image_url': f"data:image/jpeg;base64,{payload.image_base64}",
                    },
                ],
            }
        ],
        'text': {
            'format': {
                'type': 'json_schema',
                'name': 'book_cover_metadata',
                'schema': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        'is_book': {'type': 'boolean'},
                        'title': {'type': 'string'},
                        'author': {'type': 'string'},
                        'description': {'type': 'string'},
                        'category': {'type': 'string'},
                    },
                    'required': ['is_book', 'title', 'author', 'description', 'category'],
                },
            }
        },
    }

    headers = {
        'Authorization': f'Bearer {OPENAI_API_KEY}',
        'Content-Type': 'application/json',
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        try:
            response = await client.post(
                'https://api.openai.com/v1/responses', json=request_payload, headers=headers
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f'OpenAI request failed: {exc}') from exc

    body = response.json()
    raw_text = _extract_json_text(body)

    if not raw_text:
        raise HTTPException(status_code=502, detail='OpenAI response missing text output')

    try:
        parsed = json.loads(raw_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail='Invalid JSON returned by OpenAI') from exc

    if not bool(parsed.get('is_book')):
        raise HTTPException(status_code=422, detail='This is not a book, scan a book')

    title = str(parsed.get('title', '')).strip()
    if not title:
        raise HTTPException(status_code=422, detail='This is not a book, scan a book')

    market = await lookup_amazon_india(
        title=title,
        author=str(parsed.get('author', 'Unknown author')).strip() or 'Unknown author',
    )

    return ExtractResponse(
        title=title,
        author=str(parsed.get('author', 'Unknown author')).strip() or 'Unknown author',
        description=str(parsed.get('description', '')).strip(),
        category=normalize_category(str(parsed.get('category', 'Other'))),
        price=market.get('price', 'N/A'),
        rating=market.get('rating', 'N/A'),
        amazon_url=market.get('amazon_url', ''),
    )


if __name__ == '__main__':
    import uvicorn

    port = int(os.getenv('PORT', '8000'))
    uvicorn.run('main:app', host='0.0.0.0', port=port, reload=True)
