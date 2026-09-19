package com.keshi.kotoba.card;

/** 「某个包里有多少张」的投影，列表页用来一次性算完所有包的计数。 */
public interface DeckCount {

    Long getDeckId();

    long getCount();
}
