Ext.define('Rally.ui.menu.bulk.DeepCopy', {
    alias: 'widget.rallyrecordmenuitembulkdeepcopy',
    extend: 'Rally.ui.menu.bulk.MenuItem',

    config: {
        onBeforeAction: function(){
            console.log('onbeforeaction');
        },

        /**
         * @cfg {Function} onActionComplete a function called when the specified menu item action has completed
         * @param Rally.data.wsapi.Model[] onActionComplete.successfulRecords any successfully modified records
         * @param Rally.data.wsapi.Model[] onActionComplete.unsuccessfulRecords any records which failed to be updated
         */
        onActionComplete: function(){
            console.log('onActionComplete');
        },

        text: 'Copy to Parent...',

        handler: function () {
            this._onBulkCopyToParentClicked();
        },
        predicate: function (records) {
            return _.every(records, function (record) {
                return record.self.isArtifact() || record.self.isTimebox();
            });
        }
    },
     _onBulkCopyToParentClicked: function() {
        var records = this.records,
            me = this;
        console.log('_showParentPicker');
        //todo add filters so that records cannot be copied to children of the template portfolio item

        Ext.create("Rally.ui.dialog.ArtifactChooserDialog", {
            artifactTypes: [this.portfolioItemType.toLowerCase()],
            autoShow: true,
            height: 250,
            title: 'Choose Parent to copy to',
            storeConfig: {
                context: {
                    project: null,
                    workspace: Rally.util.Ref.getRelativeUri(this.getContext().getWorkspace()),

                },
                fetch: ['FormattedID','Name','Project']
            },
            autoShow: true,
            columns: [
                {
                    text: 'ID',
                    dataIndex: 'FormattedID',
                    renderer: _.identity
                },
                'Name',
                'Project'
            ],
            listeners: {
                artifactchosen: function(dialog, selectedRecord){
                    console.log('artifactchosen');
                    me.copyRecords(records, selectedRecord);
                },
                scope: me
            }
        });
    },
    _copyRecord: function(record, parent){
        var deferred = Ext.create('Deft.Deferred');

        var artifactTree = Ext.create('Rally.technicalservices.ArtifactTree',{
            portfolioItemTypes: this.portfolioItemTypes,
            listeners: {
                treeloaded: function(tree){
                     tree.deepCopy(parent);
                },
                copycompleted: function(rootRecord){
                    deferred.resolve(rootRecord);
                },
                copyerror: function(errorMsg){
                    deferred.resolve(errorMsg);
                },
                statusupdate: function(done, total){
                    this.fireEvent('statusupdate',done,total);
                },
                scope: this
            }
        });
        artifactTree.load(record);

        return deferred;
    },
    copyRecords: function(records, parent){
        var promises= [],
            successfulRecords = [],
            unsuccessfulRecords = [];
        _.each(records, function(r){
            promises.push(function() {
                return this._copyRecord(r, parent);
            });
        }, this);

        Deft.Chain.sequence(promises, this).then({
            success: function(results){
                var errorMessage = '';
                _.each(results, function(r){
                    if (Ext.isString(r)){
                        errorMessage = r;
                        unsuccessfulRecords.push(r);
                    } else {
                        successfulRecords.push(r);
                    }
                });
                this.onSuccess(successfulRecords, unsuccessfulRecords, {parent: parent}, errorMessage);
                console.log('success',successfulRecords, unsuccessfulRecords, errorMessage);
            },
            failure: function(msg){

            },
            scope: this
        });

    },
    onSuccess: function (successfulRecords, unsuccessfulRecords, args, errorMessage) {

        var formattedID = args && args.parent.get('FormattedID'),
            message = successfulRecords.length + (successfulRecords.length === 1 ? ' item has' : ' items have');

        if(successfulRecords.length === this.records.length) {
            Rally.ui.notify.Notifier.show({
                message: message +  'been deep copied to ' + formattedID
            });
        } else {
            Rally.ui.notify.Notifier.showWarning({
                message: message + ', but ' + unsuccessfulRecords.length + ' failed: ' + errorMessage
            });
        }

        Ext.callback(this.onActionComplete, null, [successfulRecords, unsuccessfulRecords]);
    }
});