import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
from selenium.webdriver.chrome.service import Service as ChromiumService
from webdriver_manager.chrome import ChromeDriverManager
from openai import OpenAI
import json
import requests

client = OpenAI(api_key='')

def analyze_property_details_llm(page_text: str) -> dict:
    """
    LLM을 활용하여 페이지 텍스트에서 숙소의 주요 시설 정보(침실, 침대, 욕실 개수)와 
    숙소의 특징(최대 300자 내)을 JSON 형식으로 추출합니다.
    응답은 반드시 아래 JSON 형식을 따르도록 요청합니다:
    
    {
      "bedrooms": "<침실 수 혹은 '정보 없음'>",
      "beds": "<침대 수 혹은 '정보 없음'>",
      "bathrooms": "<욕실 수 혹은 '정보 없음'>",
      "property_features": "<최대 300자 내 숙소 설명>"
    }
    """
    messages = [
        {
            "role": "user",
            "content": (
                "다음 숙소 정보를 아래 형식의 JSON으로 추출해줘. "
                "숫자 정보가 나타나지 않으면 '정보 없음'이라고 표기해줘.\n\n"
                "형식:\n"
                "{\n"
                '  "bedrooms": "<침실 수 혹은 \'정보 없음\'>",\n'
                '  "beds": "<침대 수 혹은 \'정보 없음\'>",\n'
                '  "bathrooms": "<욕실 수 혹은 \'정보 없음\'>",\n'
                '  "property_features": "<최대 300자 내 숙소 설명>"\n'
                "}\n\n"
                f"페이지 텍스트:\n{page_text[:1000]}\n"  # 텍스트가 너무 길면 앞 1000자만 사용
            )
        }
    ]
    
    try:
        api_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=150,
        )
        ai_message = api_response.choices[0].message.content.strip() if api_response.choices else ""
        result = json.loads(ai_message)
        return result
    except Exception as e:
        return {
            "bedrooms": "정보 없음",
            "beds": "정보 없음",
            "bathrooms": "정보 없음",
            "property_features": f"LLM 요청 중 오류 발생: {e}"
        }

def traverse_dict(dictionary, image_links):
    """
    재귀적으로 dict 내부에 있는 'baseUrl' 키의 값 중 
    'original'이 포함된 URL을 이미지 리스트(image_links)에 추가합니다.
    """
    for key, value in dictionary.items():
        if isinstance(value, dict):
            traverse_dict(value, image_links)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    traverse_dict(item, image_links)
        elif key == 'baseUrl' and isinstance(value, str) and 'original' in value and value not in image_links:
            image_links.append(value)

def extract_airbnb_property_details(url: str) -> dict:
    """
    해당 Airbnb 숙소 상세 페이지에서 JSON 스크립트를 분석하여 이미지 URL들을 추출하고,
    페이지 텍스트를 분석하여 침실, 침대, 욕실 개수를 구분하며,
    특정 div 클래스 내 텍스트를 통해 숙소의 특징을 요약하여 반환합니다.
    """
    headers = {
       'user-agent': ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/114.0.0.0 Safari/537.36'),
       'accept': ('text/html,application/xhtml+xml,application/xml;q=0.9,'
                  'image/avif,image/webp,image/apng,*/*;q=0.8,'
                  'application/signed-exchange;v=b3;q=0.7')
    }
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 이미지 URL 추출을 위한 리스트 초기화
    image_links = []
    script_tag = soup.find('script', id='data-deferred-state-0')
    if script_tag:
        try:
            script_text = script_tag.get_text()
            data = json.loads(script_text)['niobeMinimalClientData'][0][1]['data']['presentation']
            traverse_dict(data, image_links)
        except Exception as e:
            print("JSON 파싱 중 오류 발생:", e)
    else:
        print("스크립트 태그 <script id='data-deferred-state-0'>를 찾을 수 없습니다. <img> 태그로 대체합니다.")
        image_tags = soup.find_all("img")
        for img in image_tags:
            src = img.get("src")
            if src and "https://" in src and src not in image_links:
                image_links.append(src)
                
    total_image_count = len(image_links)
    
    # 전체 페이지 텍스트 가져오기
    page_text = soup.get_text(separator=" ", strip=True)
    
    # 정규표현식으로 시설 정보(침실, 침대, 욕실) 추출
    bedrooms_matches = re.findall(r"(\d+)\s*침실", page_text)
    beds_matches     = re.findall(r"(\d+)\s*침대", page_text)
    bathrooms_matches= re.findall(r"(\d+)\s*욕실", page_text)
    
    bedrooms = bedrooms_matches[0] if bedrooms_matches else "정보 없음"
    beds     = beds_matches[0] if beds_matches else "정보 없음"
    bathrooms= bathrooms_matches[0] if bathrooms_matches else "정보 없음"
    
    # 특정 div 클래스 내 텍스트 추출 (숙소의 특징 요약)
    target_divs = soup.select(
        "div.t110hta1.atm_g3_gktfv.atm_ks_15vqwwr.atm_sq_1l2sidv."
        "atm_9s_cj1kg8.atm_6w_1e54zos.atm_fy_cs5v99."
        "atm_ks_zryt35__1rgatj2.dir.dir-ltr"
    )
    extracted_texts = []
    for div in target_divs:
        text_content = div.get_text(strip=True)
        if text_content:
            extracted_texts.append(text_content)
    
    if extracted_texts:
        property_features = "\n".join(extracted_texts)
    else:
        property_features = page_text[:300] + "..."
    
    return {
        "image_urls": image_links,
        "total_image_count": total_image_count,
        "bedrooms": bedrooms,
        "beds": beds,
        "bathrooms": bathrooms,
        "property_features": property_features,
    }

def filter_valid_images(image_urls: list) -> list:
    """
    HEAD 요청을 통해 각 이미지 URL에 빠르게 접근 가능한지 확인하여,
    유효한 이미지 URL만을 반환합니다.
    """
    valid_urls = []
    for url in image_urls:
        try:
            response = requests.head(url, timeout=3)
            if response.status_code == 200:
                valid_urls.append(url)
            else:
                print(f"Skipping image (status {response.status_code}): {url}")
        except Exception as e:
            print(f"Skipping image due to error: {e} - URL: {url}")
    return valid_urls

def analyze_images(image_urls: list) -> dict:
    """
    주어진 이미지 URL 리스트를 이용해 OpenAI Vision API를 호출하여 
    이미지들에 담긴 인테리어 디자인의 핵심 요소를 한 번에 요약 분석합니다.
    
    여러 이미지가 있는 경우, 각 이미지에 대한 상세 설명을 개별적으로 나열하지 않고,
    종합적으로 한 번에 요약하여 제공하도록 요청합니다.
    """
    # 유효한 이미지 URL만을 선별합니다.
    valid_image_urls = filter_valid_images(image_urls)
    if not valid_image_urls:
        return {
            "description_from_ai": "유효한 이미지 URL이 없습니다.",
            "bed_count": "정보 없음"
        }
        
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "아래 이미지들을 분석한 결과, 이미지에 담긴 인테리어 디자인의 핵심 요소(예: 조명, 레이아웃, 색 구성, 분위기 등),숙소의 방(침실), 침대, 욕실 등 주요 시설의 개수를 구분하며 숙소의 특징을 간략하게 요약해줘. 또한 같은 장소에 대해 여러 사진이 있다고 생각되면 이는 하나의 공간으로 생각해야돼 "
                        " 만약 여러 이미지가 있다면 개별 설명 없이 한 번에 종합해서 제공해줘. "
                        "숙소와 관련 없는 이미지는 무시해도 돼."
                    ),
                }
            ] + [
                {
                    "type": "image_url",
                    "image_url": {"url": url}
                } for url in valid_image_urls
            ]
        }
    ]
    
    try:
        api_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=300,
        )
        ai_message = (
            api_response.choices[0].message.content.strip() 
            if api_response.choices else ""
        )
        return {
            "description_from_ai": ai_message
        }
    except Exception as e:
        return {
            "description_from_ai": f"이미지 처리 중 오류: {e}"
        }

if __name__ == "__main__":
    url = ("https://www.airbnb.co.kr/rooms/1084482008833333635?"
           "category_tag=Tag%3A7769&search_mode=flex_destinations_search&adults=1"
           "&check_in=2025-03-03&check_out=2025-03-08&children=0&infants=0&pets=0"
           "&photo_id=2068618064&source_impression_id=p3_1739380360_P33GmlLJNfx6B2jz"
           "&previous_page_section_name=1000&federated_search_id=d14d7985-c686-4de2-9292-142c4dd3d193")
    
    # 페이지에서 모든 이미지 URL 추출
    details = extract_airbnb_property_details(url)
    
    print("총 이미지 수:", details["total_image_count"])
    
    print("\n추출된 이미지 URL:")
    for img_url in details["image_urls"]:
        print(" -", img_url)
        
    # 해당 이미지들에 대해 LLM을 통한 분석 진행
    image_analysis_result = analyze_images(details["image_urls"])
    
    print("\nLLM을 통한 이미지 분석 결과 (숙소 특징 요약):")
    print(image_analysis_result["description_from_ai"])
