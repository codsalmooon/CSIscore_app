from __future__ import annotations

import os
import random

import streamlit as st

from csi import (
    COLLABORATION_ITEMS,
    ITEMS,
    PAIR_COMPARISONS,
    PAIR_DESCRIPTIONS_JA,
    calculate_scores,
    new_participant_id,
)
from storage import (
    EXPERIMENT_CONDITION_NAMES,
    condition_summary,
    condition_summary_csv,
    connect,
    delete_response,
    factor_data_csv,
    factor_summary,
    init_db,
    item_data_csv,
    list_experiment_conditions,
    pair_data_csv,
    participant_completion_summary,
    raw_data_csv,
    response_rows,
    save_response,
)


ADMIN_PASSCODE = os.environ.get("CSI_ADMIN_PASSCODE", "csi-admin")


st.set_page_config(page_title="CSI Score", layout="wide")


@st.cache_resource
def get_connection():
    conn = connect()
    init_db(conn)
    return conn


def ensure_participant_id() -> str:
    if "participant_id" not in st.session_state:
        st.session_state.participant_id = new_participant_id()
    return st.session_state.participant_id


def reset_response_state() -> None:
    for key in list(st.session_state.keys()):
        if key.startswith("pair_choice_"):
            del st.session_state[key]
    st.session_state.csi_step = 0
    st.session_state.csi_item_scores = {}
    st.session_state.csi_pair_choices = {}
    st.session_state.csi_pair_order = []
    st.session_state.csi_condition_id = None
    st.session_state.csi_condition_name = None


def reset_experiment_state(*, new_participant: bool = False) -> None:
    reset_response_state()
    st.session_state.csi_completed_condition_ids = []
    if new_participant or "participant_id" not in st.session_state:
        st.session_state.participant_id = new_participant_id()


def ensure_response_state() -> None:
    if "csi_step" not in st.session_state:
        reset_experiment_state()
    if "csi_completed_condition_ids" not in st.session_state:
        st.session_state.csi_completed_condition_ids = []


def ensure_pair_order() -> list[int]:
    pair_count = len(PAIR_COMPARISONS)
    pair_order = st.session_state.get("csi_pair_order", [])
    if sorted(pair_order) != list(range(pair_count)):
        pair_order = list(range(pair_count))
        st.session_state.csi_pair_order = pair_order
    return pair_order


def inject_app_styles() -> None:
    st.markdown(
        """
        <style>
        .block-container {
            max-width: 960px;
            padding-left: 1rem;
            padding-right: 1rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def inject_slider_styles() -> None:
    st.markdown(
        """
        <style>
        .csi-item-question {
            width: 960px;
            max-width: 100%;
            margin: 3rem auto 0.95rem;
            font-weight: 600;
            line-height: 1.5;
            text-align: left;
        }
        .csi-na-caption {
            width: 960px;
            max-width: 100%;
            margin: 0.15rem auto 0;
            color: rgba(49, 51, 63, 0.72);
            font-size: 0.875rem;
            text-align: left;
        }
        .stSlider {
            width: 640px !important;
            max-width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            --primary-color: #111111;
            --primary-color-hover: #111111;
        }
        .csi-item-question + div[data-testid="stHorizontalBlock"] {
            width: 960px;
            max-width: 100%;
            margin: 0 auto 0.35rem;
            align-items: center;
        }
        .csi-item-submit-row {
            width: 100%;
            padding-top: 2.75rem;
        }
        .csi-side-label {
            color: rgba(49, 51, 63, 0.72);
            font-size: 0.875rem;
            line-height: 1.25;
            white-space: nowrap;
        }
        .csi-side-label.left {
            text-align: right;
        }
        .csi-side-label.right {
            text-align: left;
        }
        div[data-testid="stTickBar"] {
            display: none;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def inject_pair_styles() -> None:
    st.markdown(
        """
        <style>
        div[data-testid="column"]:has(.csi-pair-button-marker) button {
            min-height: 11rem;
            width: 100%;
            padding: 1.5rem;
            border: 1px solid rgba(49, 51, 63, 0.22);
            border-radius: 8px;
            background: #ffffff;
            color: #111111;
            white-space: pre-wrap;
            font-size: 1.02rem;
            font-weight: 600;
            line-height: 1.45;
            text-align: center;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker) button:hover {
            border-color: #111111;
            color: #111111;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker.selected) button {
            border: 4px solid #111111 !important;
            background: #111111 !important;
            color: #ffffff !important;
            box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.14) !important;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker.selected) button:hover {
            background: #111111 !important;
            color: #ffffff !important;
            border-color: #111111 !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_labeled_slider(
    item_id: str,
    text: str,
    value: int,
    *,
    disabled: bool = False,
) -> int:
    st.markdown(f'<div class="csi-item-question">{text}</div>', unsafe_allow_html=True)
    left, center, right = st.columns(
        [1.6, 6.4, 1.6],
        gap="small",
        vertical_alignment="center",
    )
    with left:
        st.markdown(
            '<div class="csi-side-label left">まったくそう思わない</div>',
            unsafe_allow_html=True,
        )
    with center:
        selected = st.slider(
            text,
            0,
            10,
            value,
            disabled=disabled,
            key=f"slider_{item_id}",
            label_visibility="collapsed",
        )
    with right:
        st.markdown(
            '<div class="csi-side-label right">とてもそう思う</div>',
            unsafe_allow_html=True,
        )
    return int(selected)


def render_condition_page(conditions) -> None:
    participant_id = ensure_participant_id()
    st.text_input("参加者ID", value=participant_id, disabled=True)

    completed_ids = set(st.session_state.csi_completed_condition_ids)
    completed_names = [
        row["name"]
        for row in conditions
        if row["id"] in completed_ids
    ]
    remaining_conditions = [
        row
        for row in conditions
        if row["id"] not in completed_ids
    ]

    st.write(f"回答済み条件: {len(completed_names)} / {len(EXPERIMENT_CONDITION_NAMES)}")
    if completed_names:
        st.caption("回答済み: " + "、".join(completed_names))

    if not remaining_conditions:
        st.session_state.csi_step = len(PAIR_COMPARISONS) + 2
        st.rerun()

    condition_options = {row["name"]: row["id"] for row in remaining_conditions}
    condition_names = list(condition_options.keys())

    with st.form("condition_selection"):
        selected_condition_name = st.selectbox("未回答の条件", condition_names)
        _, next_col = st.columns([3, 1])
        with next_col:
            submitted = st.form_submit_button("10段階評価へ進む")

    if submitted:
        st.session_state.csi_condition_id = condition_options[selected_condition_name]
        st.session_state.csi_condition_name = selected_condition_name
        st.session_state.csi_step = 1
        st.rerun()


def render_item_page() -> None:
    inject_slider_styles()
    st.subheader("10段階評価")
    st.write(f"条件: {st.session_state.csi_condition_name}")

    with st.form("csi_items"):
        item_scores = {}
        for item in ITEMS:
            default_value = int(st.session_state.csi_item_scores.get(item["id"], 5))
            item_scores[item["id"]] = render_labeled_slider(
                item["id"],
                item["text_ja"],
                default_value,
            )

        for item in COLLABORATION_ITEMS:
            render_labeled_slider(item["id"], item["text_ja"], 0, disabled=True)

        st.markdown('<div class="csi-item-submit-row"></div>', unsafe_allow_html=True)
        _, col_next = st.columns([3, 1])
        with col_next:
            submitted = st.form_submit_button("ペア比較へ進む")

    if submitted:
        st.session_state.csi_item_scores = item_scores
        pair_order = list(range(len(PAIR_COMPARISONS)))
        random.shuffle(pair_order)
        st.session_state.csi_pair_order = pair_order
        st.session_state.csi_pair_choices = {}
        st.session_state.csi_step = 2
        st.rerun()

def render_pair_page(conn) -> None:
    inject_pair_styles()
    pair_index = st.session_state.csi_step - 2
    pair_order = ensure_pair_order()
    original_pair_index = pair_order[pair_index]
    factor_a, factor_b = PAIR_COMPARISONS[original_pair_index]

    st.subheader(f"ペア比較 {pair_index + 1} / {len(PAIR_COMPARISONS)}")
    st.caption("このタスクを行ううえで、より重要だったものを選んでください。")
    st.progress((pair_index + 1) / len(PAIR_COMPARISONS))

    existing_choice = st.session_state.csi_pair_choices.get(pair_index, factor_a)
    choice = existing_choice

    left_col, right_col = st.columns(2, gap="large")
    with left_col:
        st.markdown(
            f'<span class="csi-pair-button-marker{" selected" if existing_choice == factor_a else ""}"></span>',
            unsafe_allow_html=True,
        )
        if st.button(
            (
                f"{'選択中 / ' if existing_choice == factor_a else ''}項目1"
                f"\n\n{PAIR_DESCRIPTIONS_JA[factor_a]}"
            ),
            key=f"select_pair_{pair_index}_a",
            use_container_width=True,
            type="primary" if existing_choice == factor_a else "secondary",
        ):
            st.session_state.csi_pair_choices[pair_index] = factor_a
            st.rerun()

    with right_col:
        st.markdown(
            f'<span class="csi-pair-button-marker{" selected" if existing_choice == factor_b else ""}"></span>',
            unsafe_allow_html=True,
        )
        if st.button(
            (
                f"{'選択中 / ' if existing_choice == factor_b else ''}項目2"
                f"\n\n{PAIR_DESCRIPTIONS_JA[factor_b]}"
            ),
            key=f"select_pair_{pair_index}_b",
            use_container_width=True,
            type="primary" if existing_choice == factor_b else "secondary",
        ):
            st.session_state.csi_pair_choices[pair_index] = factor_b
            st.rerun()

    _, col_next = st.columns([3, 1])
    with col_next:
        next_label = "回答を完了する" if pair_index == len(PAIR_COMPARISONS) - 1 else "次へ"
        if st.button(next_label, type="primary", use_container_width=True):
            st.session_state.csi_pair_choices[pair_index] = choice
            if pair_index == len(PAIR_COMPARISONS) - 1:
                finalize_response(conn)
            else:
                st.session_state.csi_step += 1
            st.rerun()


def finalize_response(conn) -> int:
    pair_order = ensure_pair_order()
    pair_choices = [
        st.session_state.csi_pair_choices[index]
        for index in range(len(PAIR_COMPARISONS))
    ]
    scores = calculate_scores(
        st.session_state.csi_item_scores,
        pair_choices,
        pair_order=pair_order,
    )
    response_id = save_response(
        conn=conn,
        participant_id=st.session_state.participant_id,
        condition_id=st.session_state.csi_condition_id,
        item_scores=st.session_state.csi_item_scores,
        pair_choices=pair_choices,
        pair_order=pair_order,
        scores=scores,
    )
    st.session_state.last_response_id = response_id
    completed_ids = set(st.session_state.csi_completed_condition_ids)
    completed_ids.add(st.session_state.csi_condition_id)
    reset_response_state()
    st.session_state.csi_completed_condition_ids = list(completed_ids)
    if len(completed_ids) >= len(EXPERIMENT_CONDITION_NAMES):
        st.session_state.csi_step = len(PAIR_COMPARISONS) + 2
    else:
        st.session_state.csi_step = 0
    return response_id


def render_completion_page() -> None:
    st.subheader("回答が完了しました")
    st.success("3条件すべての回答が完了しました。ご回答ありがとうございました。")
    if st.button("新しい回答を開始する"):
        reset_experiment_state(new_participant=True)
        st.rerun()


def render_participant_page(conn) -> None:
    st.title("CSI回答フォーム")

    ensure_response_state()
    conditions = list_experiment_conditions(conn)
    if not conditions:
        st.info("回答条件を準備しています。ページを再読み込みしてください。")
        return

    max_step = len(PAIR_COMPARISONS) + 2
    if st.session_state.csi_step <= 0:
        render_condition_page(conditions)
    elif st.session_state.csi_step == 1:
        render_item_page()
    elif st.session_state.csi_step <= len(PAIR_COMPARISONS) + 1:
        render_pair_page(conn)
    elif st.session_state.csi_step == max_step:
        render_completion_page()
    else:
        reset_response_state()
        st.rerun()


def render_admin_page(conn) -> None:
    st.title("研究者画面")
    passcode = st.text_input("パスコード", type="password")
    if passcode != ADMIN_PASSCODE:
        st.warning("研究者画面を表示するにはパスコードを入力してください。")
        return

    st.caption("このアプリの総合点は6因子版CSI（Collaboration項目N/A）です。")

    conditions = list_experiment_conditions(conn)
    st.subheader("条件一覧")
    st.dataframe([dict(row) for row in conditions], use_container_width=True)

    summaries = [dict(row) for row in condition_summary(conn)]

    responses = [dict(row) for row in response_rows(conn)]
    st.subheader("削除操作")
    with st.expander("単一の回答を削除"):
        if not responses:
            st.info("削除できる回答はありません。")
        else:
            response_labels = {
                (
                    f"回答ID {row['id']} / {row['participant_id']} / "
                    f"{row['condition_name']} / {row['submitted_at']}"
                ): row
                for row in responses
            }
            with st.form("delete_response"):
                selected_label = st.selectbox("削除する回答", list(response_labels.keys()))
                delete_passcode = st.text_input("削除用パスコード", type="password", key="delete_response_passcode")
                submitted = st.form_submit_button("回答を削除")
                if submitted:
                    if delete_passcode != ADMIN_PASSCODE:
                        st.error("パスコードが正しくありません。")
                    else:
                        selected = response_labels[selected_label]
                        deleted = delete_response(conn, int(selected["id"]))
                        if deleted:
                            st.success("回答を削除しました。")
                            st.rerun()
                        else:
                            st.warning("指定された回答は見つかりませんでした。")

    st.subheader("参加者別完了状況")
    st.dataframe(participant_completion_summary(conn), use_container_width=True)

    st.subheader("条件別集計")
    st.dataframe(summaries, use_container_width=True)

    st.subheader("因子別集計")
    st.dataframe(factor_summary(conn), use_container_width=True)

    st.subheader("CSV出力")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.download_button("ローデータCSV", raw_data_csv(conn), "csi_raw_data.csv", "text/csv")
        st.download_button("項目別CSV", item_data_csv(conn), "csi_item_data.csv", "text/csv")
    with col2:
        st.download_button("因子別CSV", factor_data_csv(conn), "csi_factor_data.csv", "text/csv")
        st.download_button("ペア比較CSV", pair_data_csv(conn), "csi_pair_data.csv", "text/csv")
    with col3:
        st.download_button(
            "条件別集計CSV",
            condition_summary_csv(conn),
            "csi_condition_summary.csv",
            "text/csv",
        )


def main() -> None:
    inject_app_styles()
    conn = get_connection()
    page = st.sidebar.radio("ページ", ["参加者回答", "研究者画面"])
    if page == "参加者回答":
        render_participant_page(conn)
    else:
        render_admin_page(conn)


if __name__ == "__main__":
    main()
