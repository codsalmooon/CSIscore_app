from __future__ import annotations

import streamlit as st

from csi import PAIR_COMPARISONS, new_participant_id


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
