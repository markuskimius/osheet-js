const DEBUG = false;


export default class OSheet {
    static VERTICAL   = 0x01;
    static HORIZONTAL = 0x02;

    editable = null;
    resizable = null;

    constructor(table, options={}) {
        this.editable = options.editable ?? new EditableTable(table, options);
        this.resizable = options.resizable ?? new ResizableTable(table, options);
    }
}


/* ***************************************************************************
* EDITABLE TABLE
*/

class EditableTable {
    editor = null;

    constructor(table, options={}) {
        this.editor = new EditableTableEditor(table, options.ecelltype);
    }
}


class EditableTableEditor {
    ecelltype = "*";

    constructor(table, ecelltype=null) {
        this.ecelltype = ecelltype ?? this.ecelltype;

        table.querySelectorAll(`:scope > * > tr > ${this.ecelltype}`).forEach((cell) => {
            cell.contentEditable = true;
        });
    }
}


/* ***************************************************************************
* RESIZABLE TABLE
*/

class ResizableTable {
    cursor = null;
    resizer = null;

    constructor(table, options={}) {
        this.cursor = new ResizableTableCursor(table, options.dcursor, options.rcelltype, options.direction);
        this.resizer = new ResizableTableResizer(table, options.allowOverflow, options.rcelltype, options.direction);
    }
}


class ResizableTableCursor {
    dcursor = "auto";
    rcelltype = "*";
    direction = OSheet.VERTICAL | OSheet.HORIZONTAL;

    constructor(table, dcursor=null, rcelltype=null, direction=null) {
        this.dcursor = dcursor ?? this.dcursor;
        this.rcelltype = rcelltype ?? this.rcelltype;
        this.direction = direction ?? this.direction;

        table.querySelectorAll(`:scope > * > tr > ${this.rcelltype}`).forEach((cell) => {
            cell.addEventListener("mousemove", (event) => event.target === cell && this.onMouseMove(event, cell));
        });
    }

    /**
    * Change the mouse cursor if we're hovering over the border
    * of a resizable cell without any modifier.
    */
    onMouseMove(event, cell) {
        cell.style.cursor = this.dcursor;

        if(!Event.getModKeys(event)) {
            switch(Cell.isOnBorder(cell, event)) {
                case Cell.TOP    : if(this.direction & OSheet.VERTICAL   && Cell.rowTopOf(cell).length)  cell.style.cursor = "row-resize"; break;
                case Cell.LEFT   : if(this.direction & OSheet.HORIZONTAL && Cell.colLeftOf(cell).length) cell.style.cursor = "col-resize"; break;
                case Cell.RIGHT  : if(this.direction & OSheet.HORIZONTAL) cell.style.cursor = "col-resize"; break;
                case Cell.BOTTOM : if(this.direction & OSheet.VERTICAL)   cell.style.cursor = "row-resize"; break;
            }
        }
    }
}


class ResizableTableResizer {
    col = null;
    row = null;
    xpos = null;
    ypos = null;
    rcelltype = "*";
    direction = OSheet.VERTICAL | OSheet.HORIZONTAL;
    allowOverflow = false;

    constructor(table, allowOverflow=null, rcelltype=null, direction=null) {
        this.allowOverflow = allowOverflow ?? this.allowOverflow;
        this.rcelltype = rcelltype ?? this.rcelltype;
        this.direction = direction ?? this.direction;

        table.querySelectorAll(`:scope > * > tr > ${this.rcelltype}`).forEach((cell) => {
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

        if(event.button == 0 && !Event.getModKeys(event)) {
            switch(Cell.isOnBorder(cell, event)) {
                case Cell.TOP    : if(this.direction & OSheet.VERTICAL)   this.row = Cell.rowTopOf(cell)  ; break;
                case Cell.LEFT   : if(this.direction & OSheet.HORIZONTAL) this.col = Cell.colLeftOf(cell) ; break;
                case Cell.RIGHT  : if(this.direction & OSheet.HORIZONTAL) this.col = Cell.colEnding(cell) ; break;
                case Cell.BOTTOM : if(this.direction & OSheet.VERTICAL)   this.row = Cell.rowEnding(cell) ; break;
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
