#import <Foundation/Foundation.h>
#import <React/RCTLog.h>
#import <WebKit/WebKit.h>

typedef void (^DecisionBlock)(BOOL);

@interface RNCWebViewDecisionManager : NSObject {
    NSInteger nextLockIdentifier;
    NSMutableDictionary *decisionHandlers;
}

@property (nonatomic) NSInteger nextLockIdentifier;
@property (nonatomic, retain) NSMutableDictionary *decisionHandlers;

+ (id)getInstance;

- (NSInteger)setDecisionHandler:(DecisionBlock)handler;
- (void)setResult:(BOOL)shouldStart forLockIdentifier:(NSInteger)lockIdentifier;
- (void)cancelDecisionForLockIdentifier:(NSInteger)lockIdentifier;
@end
