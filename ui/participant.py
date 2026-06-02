from __future__ import annotations

import random
import sqlite3

import streamlit as st

from csi import (
    ITEMS,
    PAIR_COMPARISONS,
    PAIR_DESCRIPTIONS_JA,
)
from state import (
    ensure_pair_order,
    ensure_participant_id,
    ensure_response_state,
    reset_experiment_state,
    reset_response_state,
)
from storage import EXPERIMENT_CONDITION_NAMES, list_experiment_conditions
from ui.styles import inject_pair_styles, inject_slider_styles
from workflow import finalize_response


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
    st.text_input("ID", value=participant_id, disabled=True)

    completed_ids = set(st.session_state.csi_completed_condition_ids)
    completed_names = [row["name"] for row in conditions if row["id"] in completed_ids]
    remaining_conditions = [row for row in conditions if row["id"] not in completed_ids]

    st.write(f"回答済み: {len(completed_names)} / {len(EXPERIMENT_CONDITION_NAMES)}")
    if completed_names:
        st.caption("回答済み: " + "、".join(completed_names))

    if not remaining_conditions:
        st.session_state.csi_step = len(PAIR_COMPARISONS) + 2
        st.rerun()

    condition_options = {row["name"]: row["id"] for row in remaining_conditions}
    condition_names = list(condition_options.keys())

    with st.form("condition_selection"):
        selected_condition_name = st.selectbox("入力する回答を選択", condition_names)
        _, col_next = st.columns([5, 1])
        with col_next:
            submitted = st.form_submit_button("評価へ進む", type="primary")

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
            scoreable = item["scoreable"]
            default_value = int(st.session_state.csi_item_scores.get(item["id"], 5))
            selected_value = render_labeled_slider(
                item["id"],
                item["text_ja"],
                default_value if scoreable else 0,
                disabled=not scoreable,
            )
            if scoreable:
                item_scores[item["id"]] = selected_value

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


def render_pair_page(conn: sqlite3.Connection) -> None:
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
        next_label = (
            "回答を完了する" if pair_index == len(PAIR_COMPARISONS) - 1 else "次へ"
        )
        if st.button(next_label, type="primary", use_container_width=True):
            st.session_state.csi_pair_choices[pair_index] = choice
            if pair_index == len(PAIR_COMPARISONS) - 1:
                finalize_response(conn)
            else:
                st.session_state.csi_step += 1
            st.rerun()


def render_completion_page() -> None:
    st.subheader("回答が完了しました")
    st.success("3条件すべての回答が完了しました。ご回答ありがとうございました。")
    if st.button("新しい回答を開始する"):
        reset_experiment_state(new_participant=True)
        st.rerun()


def render_participant_page(conn: sqlite3.Connection) -> None:
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
