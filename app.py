import streamlit as st
import time
import re
from openai import OpenAI
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from selenium.webdriver.chrome.service import Service as ChromiumService
from urllib.parse import quote  # ensure quote is available
import requests
from io import BytesIO


# ===== Streamlit + OpenAI 초기 설정 =====
st.title("공간지능 기반 숙소 검색 (통합 예시)")

client = OpenAI(api_key='')

if "openai_model" not in st.session_state:
    st.session_state["openai_model"] = "gpt-4o-mini"

if "messages" not in st.session_state:
    st.session_state.messages = []

if "results" not in st.session_state:
    st.session_state.results = []


# ===== (A) Selenium을 이용한 Airbnb 크롤링 함수 =====
def crawl_airbnb_listings(location: str) -> list:
    service = Service(ChromeDriverManager().install())
    options = webdriver.ChromeOptions()

    driver = webdriver.Chrome(service=ChromiumService(executable_path=ChromeDriverManager().install()))
    driver.implicitly_wait(10)

    # URL encode the location to ensure the URL is valid
    encoded_location = quote(location)
    base_url = f"https://www.airbnb.co.kr/s/{encoded_location}/homes"
    params = (
        "?refinement_paths%5B%5D=%2Fhomes"
        "&flexible_trip_lengths%5B%5D=one_week"
        "&monthly_start_date="
        "&monthly_length=3"
        "&monthly_end_date="
        "&price_filter_input_type=0"
        "&channel=EXPLORE"
        "&search_type=search_query"
        "&price_filter_num_nights=1"
        "&date_picker_type=calendar"
        "&checkin="
        "&checkout="
        "&source=structured_search_input_header"
    )
    url = base_url + params

    st.info(f"크롤링할 URL:\n{url}")
    driver.get(url)
    time.sleep(5)  # 페이지 로드 대기

    # (3) 현재 페이지 숙소(카드) 요소 찾기
    listing_cards = driver.find_elements(By.CSS_SELECTOR, "meta[itemprop='url']")
    st.write(f"→ 페이지 내 숙소 카드 개수: {len(listing_cards)}")

    listing_urls = []
    for card in listing_cards:
        try:
            listing_url = card.get_attribute('content')
            if listing_url and "rooms" in listing_url:
                # Ensure the URL starts with the scheme.
                if not listing_url.startswith("http"):
                    listing_url = "https://" + listing_url
                listing_urls.append(listing_url)
        except Exception:
            # 예외 발생 시 무시
            pass

    # 상세 페이지는 처음 3개만 분석합니다.
    results = []
    for i, detail_url in enumerate(listing_urls[:3]):
        # Sanitize the URL by stripping whitespace and quoting it
        sanitized_url = quote(detail_url.strip(), safe=":/?&=")
        
        st.write(f"\n[{i+1}/{min(3, len(listing_urls))}] 상세 페이지 크롤링 중: {sanitized_url}")
        try:
            driver.get(sanitized_url)
        except Exception as e:
            st.error(f"URL 내비게이션 실패: {sanitized_url}\n오류 메시지: {e}")
            continue

        time.sleep(5)  # 상세 페이지 로드 대기

        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')

        # ① 숙소 제목 추출
        title_element = soup.find('h1', { "class": "hpipapi" })
        title = title_element.get_text(strip=True) if title_element else '제목 없음'

        # ② 숙소 설명
        try:
            description = soup.find_all('div', {
                'class': 't110hta1 atm_g3_gktfv atm_ks_15vqwwr '
                         'atm_sq_1l2sidv atm_9s_cj1kg8 atm_6w_1e54zos '
                         'atm_fy_cs5v99 atm_ks_zryt35__1rgatj2 dir dir-ltr'
            })
        except Exception:
            description = ''

        # ③ 이미지 URL 수집 (간단 예시)
        image_elements = soup.find_all('img')
        image_urls = []
        for img in image_elements:
            src = img.get('src')
            if src and 'https://' in src:
                image_urls.append(src)

        listing_data = {
            'title': title,
            'description': description,
            'detail_url': sanitized_url,
            'image_urls': list(set(image_urls))  # 중복 제거 후 모든 이미지 사용
        }
        results.append(listing_data)

    driver.quit()
    return results


# ===== (B) 이미지 분석  =====

def analyze_images(image_urls: list) -> dict:
 
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
                } for url in image_urls
            ]
        }
    ]
    
    try:
        api_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=300,
        )
        ai_message = api_response.choices[0].message.content.strip() if api_response.choices else ""
        return {
            "description_from_ai": ai_message,
            "bed_count": "정보 없음"
        }
    except Exception as e:
        return {
            "description_from_ai": f"이미지 처리 중 오류: {e}",
            "bed_count": "정보 없음"
        }


# ===== (C) 결과 표시 함수 =====
def display_results(results: list):
    st.subheader("검색 결과")
    if not results:
        st.warning("검색 결과가 없습니다.")
        return

    for i, result in enumerate(results, start=1):
        st.markdown(f"**[{i}] {result['title']}**  \n[{result['detail_url']}]({result['detail_url']})")
        # 대표 이미지로 첫 번째 이미지 표시
        if result["image_urls"]:
            st.image(result["image_urls"][0], width=300)
        
        # 여러 이미지에 대한 AI 분석 결과 표시
        if "ai_analysis" in result and result["ai_analysis"]:
            st.markdown("**[AI 분석 결과]**")
            st.write("AI 분석:", result["ai_analysis"].get("description_from_ai", "정보 없음"))
            st.write("침대 수 예측:", result["ai_analysis"].get("bed_count", "정보 없음"))
        st.markdown("---")

def summarize_accommodation_info(results: list) -> str:
    summary_prompt = "다음은 Airbnb 숙소 옵션들의 정보입니다:\n\n"
    for idx, listing in enumerate(results, 1):
        title = listing.get("title", "제목 없음")
        description = listing.get("description", "설명 없음")
        if isinstance(description, list):
            desc_text = " ".join(
                [d.get_text(strip=True) if hasattr(d, "get_text") else str(d) for d in description]
            )
        else:
            desc_text = description

        detail_url = listing.get("detail_url", "URL 정보 없음")
        image_analysis = listing.get("ai_analysis", {})
        img_analysis_text = image_analysis.get("description_from_ai", "이미지 분석 정보 없음")
        
        summary_prompt += (
            f"{idx}. 제목: {title}\n"
            f"   설명: {desc_text}\n"
            f"   URL: {detail_url}\n"
            f"   이미지 분석: {img_analysis_text}\n\n"
        )
    
    summary_prompt += (
        "위 정보를 바탕으로 각 숙소 옵션의 주요 특징, 장단점 및 종합 평가를 포함하여, "
        "간결하게 5줄 이내로 요약 및 정리해 줘."
    )
    
    response = client.chat.completions.create(
         model=st.session_state["openai_model"],
         messages=[{"role": "user", "content": summary_prompt}],
         max_tokens=500,
    )
    return response.choices[0].message.content.strip()

# conversation_about_listings 함수 (app.py 내 정의)
def conversation_about_listings(results, summary):
    prompt = (
        "다음은 Airbnb 숙소 옵션들의 요약 정보입니다:\n\n"
        f"{summary}\n\n"
        "각 숙소의 상세 이미지 분석 결과(인테리어 디자인, 조명, 레이아웃, 색 구성, 분위기 등 및 방, 침대, 욕실 등 주요시설 개수)가 포함되어 있습니다. "
        "이 분석 내용을 바탕으로 숙소의 주요 특징, 장단점, 잠재적인 문제점까지 자세하게 평가하고 추천해 주세요. "
        "이미지 분석 결과를 충분히 반영해 상세한 평가를 5줄 이내로 작성해 주세요."
    )
    response = client.chat.completions.create(
        model=st.session_state["openai_model"],
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()

# ===== (D) Streamlit: 기존의 채팅 UI 처리 =====
# 이미 세션에 저장된 메시지들을 표시
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])


# ===== (E) 입력받은 메시지 처리 (사용자 챗 인풋) =====
if prompt := st.chat_input("무엇을 도와드릴까요? (예: 강릉 숙소 검색해줘)"):
    # 사용자 메시지를 세션에 추가
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
        
    # 예약 관련 메시지가 감지되면 예약 로직 우선 수행
    if any(keyword in prompt for keyword in ["예약", "예약하고 싶다"]):
        if st.session_state.results:
            # 예시로 첫 번째 검색 결과의 링크를 예약 URL로 사용 (사용자 선택 로직으로 확장 가능)
            booking_url = st.session_state.results[0].get("detail_url", "")
            with st.chat_message("assistant"):
                st.markdown("예약 페이지를 여는 중입니다...")
            import streamlit.components.v1 as components
            components.html(
                f"<script>window.open('{booking_url}', '_blank');</script>", height=0
            )
            st.markdown(f"[예약할 숙소 바로가기]({booking_url})")
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"예약 페이지를 열었습니다: {booking_url}"
            })
        else:
            with st.chat_message("assistant"):
                st.markdown("예약 가능한 숙소 정보가 없습니다. 먼저 숙소 검색을 진행해 주세요.")
            st.session_state.messages.append({
                "role": "assistant",
                "content": "예약 가능한 숙소 정보가 없습니다."
            })
    else:
        # 일반 대화 처리
        with st.chat_message("assistant"):
            messages_for_api = [
                {"role": m["role"], "content": m["content"]} for m in st.session_state.messages
            ]
            stream = client.chat.completions.create(
                model=st.session_state["openai_model"],
                messages=messages_for_api,
                stream=True
            )
            response = st.write_stream(stream)
        st.session_state.messages.append({"role": "assistant", "content": response})
        
        # 숙소 검색/크롤링 키워드가 포함된 경우
        if any(keyword in prompt for keyword in ["크롤링", "검색", "숙소"]):
            found_locations = re.findall(r'(강릉|서울|부산|제주|대전|대구|광주|인천|\w+)', prompt)
            location = found_locations[0] if found_locations else "서울"
            st.info(f"'{location}' 지역 숙소를 검색해볼게요. ")

            # (a) Selenium 크롤링
            results = crawl_airbnb_listings(location)

            if not results:
                st.warning("숙소 정보를 찾지 못했습니다.")
            else:
                st.info("각 숙소의 이미지들을 분석합니다...")
                for r in results:
                    if r["image_urls"]:
                        st.write(f"[{r['title']}] 이미지들을 분석 중...")
                        analysis = analyze_images(r["image_urls"])
                        r["ai_analysis"] = analysis
                    else:
                        r["ai_analysis"] = {}
                st.session_state.results = results

                # 자동으로 LLM 추천 메시지 생성 후 같은 채팅창 내에 출력
                if st.session_state.results and not st.session_state.get("llm_recommendation"):
                    final_summary = summarize_accommodation_info(st.session_state.results)
                    st.session_state.accommodations_summary = final_summary
                    recommendation = conversation_about_listings(st.session_state.results, final_summary)
                    st.session_state.llm_recommendation = recommendation
                    with st.chat_message("assistant"):
                        st.markdown("**LLM 추천:**")
                        st.write(recommendation)
                        st.markdown("---")
                        st.markdown("**숙소 정보:**")
                        for listing in st.session_state.results:
                            st.markdown(f"**[{listing['title']}]({listing['detail_url']})**")
                            # 각 숙소 설명 바로 아래에 대표 이미지 출력
                            if listing.get("image_urls"):
                                st.image(listing["image_urls"][0], width=300)
                            if "ai_analysis" in listing and listing["ai_analysis"]:
                                st.markdown("**[AI 분석 결과]**")
                                st.write("", listing["ai_analysis"].get("description_from_ai", "정보 없음"))
                                st.write("", listing["ai_analysis"].get("bed_count", "정보 없음"))
                            st.markdown("---")

