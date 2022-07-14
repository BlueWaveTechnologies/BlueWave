if(!javaxt) var javaxt={};
if(!javaxt.dhtml) javaxt.dhtml={};
if(!javaxt.dhtml.style) javaxt.dhtml.style={};

//******************************************************************************
//**  Default Style
//******************************************************************************
/**
 *   Common style definitions for JavaXT components.
 *
 ******************************************************************************/

javaxt.dhtml.style.default = {

    window : {
        panel: "window",
        header: "panel-header window-header",
        title: "panel-title window-title",
        button: "window-header-button",
        buttonBar: "window-header-button-bar",
        mask: "window-mask"
    },


    callout : {
        panel: "callout-panel",
        arrow: "callout-arrow"
    },


    form : {
        label: "form-label noselect",
        input: "form-input",
        icon: {
            padding: "0 8px 6px 0"
        },
        button: "form-button noselect",
        radio: "form-radio noselect",
        checkbox: "form-checkbox",
        groupbox: "form-groupbox",
        grouplabel: "form-grouplabel noselect"
    },


    combobox : {
        input: "form-input form-input-with-button",
        button: "form-button form-input-button pulldown-button-icon",
        menu: "form-input-menu",
        option: "form-input-menu-item",
        newOption: "form-input-menu-item form-input-menu-item-new"
    },


    checkbox : {
        box:   "checkbox-box",
        label: "checkbox-label",
        check: "checkbox-check",
        select: "checkbox-select",
        disable: "checkbox-disable",
        hover: "checkbox-hover"
    },
    

    toolbarButton : {
        button: "toolbar-button",
        select: "toolbar-button-selected",
        hover:  "toolbar-button-hover",
        label: "toolbar-button-label"
    },


    table: {
        headerRow: "table-header",
        headerColumn : "table-header-col",
        row: "table-row",
        column: "table-col",
        selectedRow: "table-row-selected",
        resizeHandle: "table-resizeHandle",
        ascendingSortIcon: "table-icon-sort-asc",
        descendingSortIcon: "table-icon-sort-desc",
        iscroll: {
            horizontalScrollbar: "iScrollHorizontalScrollbar",
            verticalScrollbar: "iScrollVerticalScrollbar",
            indicator: "iScrollIndicator"
        }
    },

    tabPanel: {

    },

    switch: {
        groove: "switch-groove",
        handle: "switch-handle",
        grooveActive: "switch-groove-active",
        handleActive: "switch-handle-active"
    },

    merge : function(settings, defaults) {
        javaxt.dhtml.utils.merge(settings, defaults);
        return settings;
    }
};