class PieceManager {
    constructor(totalPieces, isSeeder){
        this.totalPieces = totalPieces;

        //bitfiled : true = have Piece
        this.pieces = new Array(totalPieces).fill(isSeeder);
    }

    hasPiece(index){
        return this.pieces[index];
    }

    addPiece(index){
        this.pieces[index] = true;
    }

    getMissingPiece(){
        for(let i = 0; i< this.totalPieces; i++){
            if(!this.pieces[i]){
                return i;
            }
        }
        return null;
    }

    getBitField(){
        return this.pieces;
    }

    isComplete(){
        return this.pieces.every(Boolean);
    }
}

module.exports = PieceManager;