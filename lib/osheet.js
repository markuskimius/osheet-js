const DEBUG = false;


export default class OSheet {
    static RIGHT  = 0x01;
    static BOTTOM = 0x02;

    editor = null;
    resizer = null;
    observer = null;
    cursorHandler = null;

    constructor(table, options={}) {
        this.editor = new TableEditor(table, options);
        this.resizer = new TableResizer(table, options);
        this.observer = new TableObserver(table, options);
        this.cursorHandler = new TableCursorHandler(table, options);
    }
}


/* ***************************************************************************
* TABLE OBSERVER
*/

class TableObserver {
    constructor(table, options={}) {
    }
}


/* ***************************************************************************
* TABLE CURSOR HANDLER
*/

class TableCursorHandler {
    editable = true;
    editableTag = "td";
    resizable = true;
    resizableTag = "*";
    resizableSide = OSheet.RIGHT | OSheet.BOTTOM;

    constructor(table, options={}) {
        this.editable = options.editable ?? this.editable;
        this.editableTag = options.editableTag ?? this.editableTag;
        this.resizable = options.resizable ?? this.resizable;
        this.resizableTag = options.resizableTag ?? this.resizableTag;
        this.resizableSide = options.resizableSide ?? this.resizableSide;

        table.querySelectorAll(`:scope > * > tr > ${this.resizableTag}`).forEach((cell) => {
            cell.addEventListener("mousemove", (event) => event.target === cell && this.onMouseMove(event, cell));
        });

        table.querySelectorAll(`:scope > * > tr > ${this.editableTag}`).forEach((cell) => {
            cell.addEventListener("mousemove", (event) => event.target === cell && this.onMouseMoveEditable(event, cell));
        });

        table.querySelectorAll(`:scope > * > tr > ${this.resizableTag}`).forEach((cell) => {
            cell.addEventListener("mousemove", (event) => event.target === cell && this.onMouseMoveResizable(event, cell));
        });
    }

    /**
    * Change the mouse cursor to default.
    */
    onMouseMove(event, cell) {
        cell.style.cursor = "auto";
    }

    /**
    * Change the mouse cursor to resize cursor if we're hovering over the
    * border of a resizable cell without any modifier.
    */
    onMouseMoveResizable(event, cell) {
        if(this.resizable && !Event.getModKeys(event)) {
            switch(Cell.isOnBorder(cell, event)) {
                case Cell.TOP    : if(this.resizableSide & OSheet.BOTTOM && Cell.rowTopOf(cell).length)  cell.style.cursor = "row-resize"; break;
                case Cell.LEFT   : if(this.resizableSide & OSheet.RIGHT  && Cell.colLeftOf(cell).length) cell.style.cursor = "col-resize"; break;
                case Cell.RIGHT  : if(this.resizableSide & OSheet.RIGHT)  cell.style.cursor = "col-resize"; break;
                case Cell.BOTTOM : if(this.resizableSide & OSheet.BOTTOM) cell.style.cursor = "row-resize"; break;
            }
        }
    }

    /**
    * Change the mouse cursor to the cell cursor if we're hovering over an
    * editable cell but not editing.
    */
    onMouseMoveEditable(event, cell) {
        if(this.editable && cell.contentEditable && document.activeElement !== cell) {
            cell.style.cursor = "cell";
        }
    }
}


/* ***************************************************************************
* TABLE EDITOR
*/

class TableEditor {
    editable = true;
    editableTag = "*";

    constructor(table, options={}) {
        this.editable = options.editable ?? this.editable;
        this.editableTag = options.editableTag ?? this.editableTag;

        table.querySelectorAll(`:scope > * > tr > ${this.editableTag}`).forEach((cell) => {
            cell.contentEditable = this.editable;
        });
    }
}


/* ***************************************************************************
* RESIZABLE TABLE
*/

class TableResizer {
    resizable = true;
    resizableTag = "*";
    resizableSide = OSheet.RIGHT | OSheet.BOTTOM;
    allowOverflow = true;
    col = null;
    row = null;
    xpos = null;
    ypos = null;

    constructor(table, options={}) {
        this.resizable = options.resizable ?? this.resizable;
        this.resizableTag = options.resizableTag ?? this.resizableTag;
        this.resizableSide = options.resizableSide ?? this.resizableSide;
        this.allowOverflow = options.allowOverflow ?? this.allowOverflow;

        table.querySelectorAll(`:scope > * > tr > ${this.resizableTag}`).forEach((cell) => {
            cell.addEventListener("mousedown" , (event) => event.target === cell && this.onMouseDown(event, cell));
            cell.addEventListener("dblclick" , (event) => event.target === cell && this.onDblClick(event, cell));
        });

        window.addEventListener("mouseup", (event) => this.onMouseUp(event));
        window.addEventListener("focusout", (event) => this.onMouseUp(event));
        window.addEventListener("mousemove", (event) => this.onMouseMove(event));
    }

    /**
    * Record where the cell resizing starts when the primary mouse button is
    * pressed on a cell border without any modifier.
    */
    onMouseDown(event, cell) {
        this.col = null;
        this.row = null;

        if(this.resizable && event.button == 0 && !Event.getModKeys(event)) {
            switch(Cell.isOnBorder(cell, event)) {
                case Cell.TOP    : if(this.resizableSide & OSheet.BOTTOM) this.row = Cell.rowTopOf(cell)  ; break;
                case Cell.LEFT   : if(this.resizableSide & OSheet.RIGHT)  this.col = Cell.colLeftOf(cell) ; break;
                case Cell.RIGHT  : if(this.resizableSide & OSheet.RIGHT)  this.col = Cell.colEnding(cell) ; break;
                case Cell.BOTTOM : if(this.resizableSide & OSheet.BOTTOM) this.row = Cell.rowEnding(cell) ; break;
            }

            if(this.col) {
                this.xpos = [];

                this.col.forEach((cell) => {
                    this.xpos.push(event.screenX - Cell.widthOf(cell));
                });

                event.stopPropagation();
                event.preventDefault();
            }

            if(this.row) {
                this.ypos = [];

                this.row.forEach((cell) => {
                    this.ypos.push(event.screenY - Cell.heightOf(cell));
                });

                event.stopPropagation();
                event.preventDefault();
            }
        }
    }

    /**
    * Stop selection when the mouse button is released.
    */
    onMouseUp(event) {
        this.col = null;
        this.row = null;
        this.xpos = null;
        this.ypos = null;
    }

    /**
    * Resize the table when the mouse is moved with the primary mouse button
    * pressed.
    */
    onMouseMove(event) {
        if(this.col) {
            this.col.forEach((cell, i) => {
                const xpos = this.xpos[i];
                const width = Math.max(0, event.screenX - xpos);

                cell.style.width = `${width}px`;
                cell.style.minWidth = `${width}px`;

                if(this.allowOverflow) {
                    cell.style.maxWidth = `${width}px`;
                }
            });

            event.preventDefault();
        }

        if(this.row) {
            this.row.forEach((cell, i) => {
                const ypos = this.ypos[i];
                const height = Math.max(0, event.screenY - ypos);

                cell.style.height = `${height}px`;
                cell.style.minHeight = `${height}px`;

                if(this.allowOverflow) {
                    cell.style.maxHeight = `${height}px`;
                }
            });

            event.preventDefault();
        }
    }

    /**
    * Restore the cell size to the default if double click primary button on a
    * cell border without any modifier.
    */
    onDblClick(event, cell) {
        this.col = null;
        this.row = null;

        if(event.button == 0 && !Event.getModKeys(event)) {
            switch(Cell.isOnBorder(cell, event)) {
                case Cell.TOP    : this.row = Cell.rowTopOf(cell)  ; break;
                case Cell.LEFT   : this.col = Cell.colLeftOf(cell) ; break;
                case Cell.RIGHT  : this.col = Cell.colEnding(cell) ; break;
                case Cell.BOTTOM : this.row = Cell.rowEnding(cell) ; break;
            }

            if(this.col) {
                this.col.forEach((cell) => {
                    cell.style.width = "auto";
                    cell.style.minWidth = "0";
                    cell.style.maxWidth = null;
                });
                this.col = null;

                event.stopPropagation();
                event.preventDefault();
            }

            if(this.row) {
                this.row.forEach((cell) => {
                    cell.style.height = "auto";
                    cell.style.minHeight = "0";
                    cell.style.maxHeight = null;
                });
                this.row = null;

                event.stopPropagation();
                event.preventDefault();
            }
        }
    }
}


/* ***************************************************************************
* HELPER CLASSES
*/

class Event {
    static ALT   = 0x01;
    static CTRL  = 0x02;
    static META  = 0x04;
    static SHIFT = 0x08;

    static getModKeys(event) {
        let modifier = 0x00;

        if(event.altKey)   modifier |= Event.ALT;
        if(event.ctrlKey)  modifier |= Event.CTRL;
        if(event.metaKey)  modifier |= Event.META;
        if(event.shiftKey) modifier |= Event.SHIFT;

        return modifier;
    }
}


class Table {
    static index(table) {
        if(!table.getAttribute("data-osheet-indexed")) this.reindex(table);

        return table;
    }

    static reindex(table) {
        let rowcount = [];
        let rownum = 0;

        table.querySelectorAll(":scope > * > tr").forEach((tr) => {
            let colnum = 0;

            tr.querySelectorAll(":scope > *").forEach((cell) => {
                const rowspan = parseInt(cell.getAttribute("rowspan")) || 1;
                const colspan = parseInt(cell.getAttribute("colspan")) || 1;

                while(rowcount[colnum] > rownum) {
                    colnum++;
                }

                cell.setAttribute("data-osheet-rownum", rownum);
                cell.setAttribute("data-osheet-colnum", colnum);
                cell.setAttribute("data-osheet-rownum2", rownum + rowspan);
                cell.setAttribute("data-osheet-colnum2", colnum + colspan);

                if(DEBUG) {
                    cell.innerText = `(${rownum}, ${colnum}), (${rownum+rowspan}, ${colnum+colspan})`;
                }

                for(let i = 0; i < colspan; i++) {
                    rowcount[colnum] = rownum + rowspan;
                    colnum++;
                }
            });

            rownum += 1;
        });

        table.setAttribute("data-osheet-indexed", true);

        return table;
    }

    static rowStarting(table, rownum) {
        this.index(table);

        return table.querySelectorAll(`:scope > * > tr > *[data-osheet-rownum="${rownum}"]`);
    }

    static colStarting(table, colnum) {
        this.index(table);

        return table.querySelectorAll(`:scope > * > tr > *[data-osheet-colnum="${colnum}"]`);
    }

    static rowEnding(table, rownum) {
        this.index(table);

        return table.querySelectorAll(`:scope > * > tr > *[data-osheet-rownum2="${rownum}"]`);
    }

    static colEnding(table, colnum) {
        this.index(table);

        return table.querySelectorAll(`:scope > * > tr > *[data-osheet-colnum2="${colnum}"]`);
    }
}


class Cell {
    static TOP    = 0x01;
    static LEFT   = 0x02;
    static RIGHT  = 0x04;
    static BOTTOM = 0x08;

    static tableOf(cell) {
        return cell.parentNode.parentNode.parentNode;
    }

    static rowEnding(cell) {
        const table = this.tableOf(cell);

        Table.index(table);

        return Table.rowEnding(table, cell.getAttribute("data-osheet-rownum2"));
    }

    static colEnding(cell) {
        const table = this.tableOf(cell);

        Table.index(table);

        return Table.colEnding(table, cell.getAttribute("data-osheet-colnum2"));
    }

    static rowTopOf(cell) {
        const table = this.tableOf(cell);

        Table.index(table);

        return Table.rowEnding(table, parseFloat(cell.getAttribute("data-osheet-rownum")));
    }

    static colLeftOf(cell) {
        const table = this.tableOf(cell);

        Table.index(table);

        return Table.colEnding(table, parseFloat(cell.getAttribute("data-osheet-colnum")));
    }

    static widthOf(cell) {
        const computed = getComputedStyle(cell);
        const hpadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);

        return cell.clientWidth - hpadding;
    }

    static heightOf(cell) {
        const computed = getComputedStyle(cell);
        const vpadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);

        return cell.clientHeight - vpadding;
    }

    static isOnBorder(cell, event) {
        let isOnBorder = 0;

        if(cell === event.target) {
            if(event.offsetY < 0)                  isOnBorder |= this.TOP    ;
            if(event.offsetX < 0)                  isOnBorder |= this.LEFT   ;
            if(cell.clientWidth <= event.offsetX)  isOnBorder |= this.RIGHT  ;
            if(cell.clientHeight <= event.offsetY) isOnBorder |= this.BOTTOM ;
        }

        return isOnBorder;
    }
}
