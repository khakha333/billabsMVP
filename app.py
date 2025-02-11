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

    # 상세 페이지는 처음 5개만 분석합니다.
    results = []
    for i, detail_url in enumerate(listing_urls[:5]):
        # Sanitize the URL by stripping whitespace and quoting it
        sanitized_url = quote(detail_url.strip(), safe=":/?&=")
        
        st.write(f"\n[{i+1}/{min(5, len(listing_urls))}] 상세 페이지 크롤링 중: {sanitized_url}")
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
            'image_urls': list(set(image_urls))[:5]  # 중복 제거 후 대표 1~5장
        }
        results.append(listing_data)

    driver.quit()
    return results


# ===== (B) 이미지 분석  =====
def analyze_image(image_url: str) -> dict:
    """
    주어진 이미지 URL을 이용해 OpenAI Vision API 기능을 호출하여 이미지 분석을 수행
    """
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "이 이미지를 한국어로 분석해 주세요. 인테리어 디자인의 세부 사항, 예를 들어 조명, "
                        "레이아웃, 색 구성, 전반적인 분위기 및 눈에 띄는 디자인 특징 등을 자세하게 설명해 주세요. "
                        "가능하다면 침대 수에 대한 추정 정보도 함께 제공해 주세요."
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_url,
                    },
                },
            ],
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


def analyze_images(image_urls: list) -> dict:
 
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "아래 이미지들을 분석한 결과, 각 이미지에 담긴 인테리어 디자인의 핵심 요소(예: 조명, 레이아웃, 색 구성, 분위기 등)을 간략하게 요약해줘. 여러장의 이미지가 있다면 각 이미지에 대한 설명을 하나씩 설명하지 않고 한 번에 종합하여 제공해줘. 이미지가 숙소와 관련이 없다면 무시해도 돼. "
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
    
    # (1) OpenAI에 메시지 전달, 스트림 모드로 응답받기 (간단 예시)
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

    # (2) 메시지 안에 "크롤링" / "검색" / "숙소" 등의 키워드가 있는 경우 => Airbnb 크롤링 시도
    if any(keyword in prompt for keyword in ["크롤링", "검색", "숙소"]):
        # 간단하게 정규식으로 사용자가 언급한 지역을 추출(예: "강릉", "서울" 등)
        found_locations = re.findall(r'(강릉|서울|부산|제주|대전|대구|광주|인천|\w+)', prompt)
        # 위 예시는 단순 데모. 실제로는 상황에 맞게 처리
        
        if found_locations:
            location = found_locations[0]  # 첫 번째 매칭
        else:
            # 못 찾으면 기본값
            location = "서울"

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
                    analysis = analyze_images(r["image_urls"][:5])
                    r["ai_analysis"] = analysis
                else:
                    r["ai_analysis"] = {}
            st.session_state.results = results
            # 개별 분석 결과를 보여주는 display_results() 호출을 제거합니다.

# LLM과의 대화를 통한 숙소 추천 기능 추가 (파일 맨 아래 또는 적절한 위치에 추가)
if st.session_state.results:
    st.subheader("LLM으로 숙소 추천 받기")
    if st.button("LLM 추천 받기"):
        def conversation_about_listings(results: list) -> str:
            """
            크롤링 및 이미지 분석 결과 기반으로 LLM에 숙소 옵션 정보를 전달,
            각 옵션의 장단점 및 추천 이유를 포함한 답변을 받아옴
            """
            listings_prompt = "아래는 Airbnb 숙소 옵션들입니다:\n\n"
            for idx, listing in enumerate(results, 1):
                # description은 BeautifulSoup 객체 리스트일 수도 있으므로 텍스트로 변환
                if isinstance(listing.get("description"), list):
                    desc_text = " ".join(
                        [s.get_text(strip=True) if hasattr(s, "get_text") else str(s)
                         for s in listing.get("description")]
                    )
                else:
                    desc_text = listing.get("description", "설명 없음")
                listings_prompt += (
                    f"{idx}. 제목: {listing['title']}\n"
                    f"   설명: {desc_text}\n"
                )
                if "bed_count" in listing:
                    listings_prompt += f"   침대 수(예시): {listing['bed_count']}\n"
                listings_prompt += f"   URL: {listing['detail_url']}\n\n"
            listings_prompt += (
                "위 옵션들을 고려하여 사용자에게 추천할 최적의 숙소를 결정할 수 있도록 "
                "각 옵션의 장단점과 선택 이유를 분석해 주세요."
            )
    
            response = client.chat.completions.create(
                model=st.session_state["openai_model"],
                messages=[{"role": "user", "content": listings_prompt}],
                max_tokens=500,  # max_tokens 를 늘림
            )
            return response.choices[0].message.content.strip()
    
        recommendation = conversation_about_listings(st.session_state.results)
        st.markdown("**LLM 추천:**")
        st.write(recommendation)
        
        # 추천 결과를 세션에 저장해 후속 질의 시 참고할 수 있도록 합니다.
        st.session_state.llm_recommendation = recommendation


# LLM 추천을 받은 후에는 해당 추천 내용을 바탕으로 추가 질의응답을 할 수 있습니다.
if st.session_state.results and st.session_state.get("llm_recommendation"):
    st.subheader("LLM 추천 기반 추가 질의응답")
    followup_question = st.text_input("추천 내용을 바탕으로 추가 질문을 입력해주세요", key="llm_followup")
    if followup_question:
        context_messages = [
            {
                "role": "system",
                "content": (
                    f"다음은 이전에 LLM이 추천한 내용입니다:\n{st.session_state.llm_recommendation}\n"
                    "이 내용을 바탕으로 사용자의 추가 질문에 답변해 주세요."
                )
            }
        ]
        context_messages.append({"role": "user", "content": followup_question})
        
        response = client.chat.completions.create(
            model=st.session_state["openai_model"],
            messages=context_messages,
            max_tokens=500,  # 추가 질의응답에 대해 max_tokens 값 증가
        )
        answer = response.choices[0].message.content.strip()
        st.markdown("**LLM 답변:**")
        st.write(answer)

        # (선택 사항) 추천 내용을 업데이트하여 대화 맥락을 누적할 수 있습니다.
        st.session_state.llm_recommendation += f"\n\n[추가 질문] {followup_question}\n[답변] {answer}"

def summarize_accommodation_info(results: list) -> str:


    summary_prompt = "다음은 Airbnb 숙소 옵션들의 정보입니다:\n\n"
    for idx, listing in enumerate(results, 1):
        title = listing.get("title", "제목 없음")
        
        # 숙소 설명이 BeautifulSoup 객체 리스트일 경우 텍스트로 변환
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



if st.session_state.results:
    st.subheader("숙소 정보 요약")
    final_summary = summarize_accommodation_info(st.session_state.results)
    st.subheader("최종 분석 결과")
    st.markdown(final_summary)
    st.session_state.accommodations_summary = final_summary


    st.subheader("LLM 추천")
    def conversation_about_listings(results: list) -> str:
        """
        크롤링 및 이미지 분석 결과 기반으로 LLM에 숙소 옵션 정보를 전달,
        각 옵션의 장단점 및 추천 이유를 포함한 답변을 받아옴
        """
        listings_prompt = "아래는 Airbnb 숙소 옵션들입니다:\n\n"
        for idx, listing in enumerate(results, 1):
            # 숙소 설명이 BeautifulSoup 객체 리스트일 경우 텍스트로 변환
            if isinstance(listing.get("description"), list):
                desc_text = " ".join(
                    [s.get_text(strip=True) if hasattr(s, "get_text") else str(s)
                     for s in listing.get("description")]
                )
            else:
                desc_text = listing.get("description", "설명 없음")
            listings_prompt += (
                f"{idx}. 제목: {listing['title']}\n"
                f"   설명: {desc_text}\n"
                f"   URL: {listing['detail_url']}\n\n"
            )
        listings_prompt += (
            "위 옵션들을 고려하여 사용자에게 추천할 최적의 숙소를 결정할 수 있도록 "
            "각 옵션의 장단점과 선택 이유를 분석해 주세요."
        )
    
        response = client.chat.completions.create(
            model=st.session_state["openai_model"],
            messages=[{"role": "user", "content": listings_prompt}],
            max_tokens=500,
        )
        return response.choices[0].message.content.strip()
    
    recommendation = conversation_about_listings(st.session_state.results)
    st.markdown("**LLM 추천:**")
    st.write(recommendation)
    st.session_state.llm_recommendation = recommendation